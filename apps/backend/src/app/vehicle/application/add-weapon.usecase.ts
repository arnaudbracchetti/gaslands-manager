import { BadRequestException } from '@nestjs/common';
import type { IVehicleRepository } from '../domain/vehicle.repository.interface';
import type { ICatalogRepository } from '../domain/catalog.repository.interface';
import type { Vehicle } from '../domain/vehicle';
import { DomainException } from '../domain/vehicle';
import type { Orientation } from '../vehicle-build';
import type { WeaponType } from '../domain/value-objects/weapon-type';
import { LogUseCase } from '../log-use-case.decorator';

export interface AddWeaponCommand {
  vehicleId: number;
  nomInterne: string;
  orientation?: Orientation | null;
  userId: number;
}

/**
 * Ajoute une arme à un véhicule existant.
 *
 * Remplace WeaponService.addWeapon() :
 *  1. Charge l'agrégat (vérifie l'appartenance).
 *  2. Vérifie que l'arme est connue du catalogue.
 *  3. Vérifie que l'arme est autorisée par le sponsor du véhicule.
 *  4. Calcule le budget restant.
 *  5. Délègue la validation métier à vehicle.addWeapon() — lève DomainException si refus.
 *  6. Persiste l'agrégat.
 *
 * DomainException → BadRequestException : le domaine ne connaît pas HTTP,
 * la conversion est la responsabilité de la couche application.
 */
export class AddWeaponUseCase {
  constructor(
    private readonly vehicleRepo: IVehicleRepository,
    private readonly catalogRepo: ICatalogRepository,
  ) {}

  @LogUseCase()
  async execute(cmd: AddWeaponCommand): Promise<Vehicle> {
    const vehicle = await this.vehicleRepo.findByIdForUser(cmd.vehicleId, cmd.userId);

    const weaponType = this.catalogRepo.getWeaponType(cmd.nomInterne);
    if (!weaponType) {
      throw new BadRequestException(`Arme inconnue du catalogue : "${cmd.nomInterne}"`);
    }

    const authorizedWeapons = this.catalogRepo.getWeaponTypesForSponsor(vehicle.sponsorNom);
    const isAuthorized = authorizedWeapons.some((w: WeaponType) => w.nomInterne === cmd.nomInterne);
    if (!isAuthorized) {
      throw new BadRequestException(
        `L'arme "${weaponType.nom}" n'est pas autorisée pour le sponsor "${vehicle.sponsorNom}"`,
      );
    }

    const budget = await this.vehicleRepo.getRemainingBudget(cmd.vehicleId, cmd.userId);

    try {
      vehicle.addWeapon(weaponType, cmd.orientation ?? null, budget);
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    return this.vehicleRepo.save(vehicle);
  }
}
