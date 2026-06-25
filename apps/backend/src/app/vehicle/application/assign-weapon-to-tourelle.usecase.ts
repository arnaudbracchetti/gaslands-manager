import { BadRequestException } from '@nestjs/common';
import type { IVehicleRepository } from '../domain/vehicle.repository.interface';
import type { ICatalogRepository } from '../domain/catalog.repository.interface';
import type { Vehicle } from '../domain/vehicle';
import { DomainException } from '../domain/vehicle';
import type { WeaponType } from '../domain/value-objects/weapon-type';
import { LogUseCase } from '../log-use-case.decorator';

export interface AssignWeaponToTourelleCommand {
  vehicleId: number;
  improvementId: number;
  weaponNomInterne: string;
  userId: number;
}

/**
 * Assigne une arme à une Tourelle orpheline.
 * Remplace VehicleService.assignWeaponToTourelle().
 * Validation sponsor + règle "pas d'arme équipage" déléguée à l'agrégat.
 */
export class AssignWeaponToTourelleUseCase {
  constructor(
    private readonly vehicleRepo: IVehicleRepository,
    private readonly catalogRepo: ICatalogRepository,
  ) {}

  @LogUseCase()
  async execute(cmd: AssignWeaponToTourelleCommand): Promise<Vehicle> {
    const vehicle = await this.vehicleRepo.findByIdForUser(cmd.vehicleId, cmd.userId);

    const weaponType = this.catalogRepo.getWeaponType(cmd.weaponNomInterne);
    if (!weaponType) {
      throw new BadRequestException(`Arme inconnue du catalogue : "${cmd.weaponNomInterne}"`);
    }

    const authorizedWeapons = this.catalogRepo.getWeaponTypesForSponsor(vehicle.sponsorNom);
    const isAuthorized = authorizedWeapons.some((w: WeaponType) => w.nomInterne === cmd.weaponNomInterne);
    if (!isAuthorized) {
      throw new BadRequestException(
        `L'arme "${weaponType.nom}" n'est pas autorisée pour le sponsor "${vehicle.sponsorNom}"`,
      );
    }

    if (weaponType.isEquipage) {
      throw new BadRequestException(
        `Les armes d'équipage ont déjà un arc de tir 360° — la Tourelle ne s'applique pas`,
      );
    }

    // Budget restant de l'équipe (tous véhicules confondus) — la garde ×3 de la
    // Tourelle est portée par l'agrégat (cf. Vehicle.assignWeaponToTourelle).
    const budget = await this.vehicleRepo.getRemainingBudget(cmd.vehicleId, cmd.userId);

    try {
      vehicle.assignWeaponToTourelle(cmd.improvementId, weaponType, budget);
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    return this.vehicleRepo.save(vehicle);
  }
}
