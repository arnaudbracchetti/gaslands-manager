import { BadRequestException } from '@nestjs/common';
import type { IVehicleRepository } from '../domain/vehicle.repository.interface';
import type { ICatalogRepository } from '../domain/catalog.repository.interface';
import type { Vehicle } from '../domain/vehicle';
import { DomainException } from '../domain/vehicle';
import { LogUseCase } from '../log-use-case.decorator';

export interface UnassignWeaponFromTourelleCommand {
  vehicleId: number;
  improvementId: number;
  userId: number;
}

/** Désassigne l'arme d'une Tourelle (retour en état orphelin). */
export class UnassignWeaponFromTourelleUseCase {
  constructor(
    private readonly vehicleRepo: IVehicleRepository,
    private readonly catalogRepo: ICatalogRepository,
  ) {}

  @LogUseCase()
  async execute(cmd: UnassignWeaponFromTourelleCommand): Promise<Vehicle> {
    const vehicle = await this.vehicleRepo.findByIdForUser(cmd.vehicleId, cmd.userId);

    try {
      vehicle.unassignWeaponFromTourelle(cmd.improvementId);
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    return this.vehicleRepo.save(vehicle);
  }
}
