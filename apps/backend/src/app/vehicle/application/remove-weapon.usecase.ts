import { BadRequestException } from '@nestjs/common';
import type { IVehicleRepository } from '../domain/vehicle.repository.interface';
import type { ICatalogRepository } from '../domain/catalog.repository.interface';
import type { Vehicle } from '../domain/vehicle';
import { DomainException } from '../domain/vehicle';
import { LogUseCase } from '../log-use-case.decorator';

export interface RemoveWeaponCommand {
  /** Fournir soit vehicleId (si connu), soit weaponId seul (route DELETE /weapons/:id). */
  vehicleId?: number;
  weaponId: number;
  userId: number;
}

/** Retire une arme d'un véhicule. Remplace WeaponService.removeWeapon(). */
export class RemoveWeaponUseCase {
  constructor(
    private readonly vehicleRepo: IVehicleRepository,
    private readonly catalogRepo: ICatalogRepository,
  ) {}

  @LogUseCase()
  async execute(cmd: RemoveWeaponCommand): Promise<Vehicle> {
    const vehicle = cmd.vehicleId
      ? await this.vehicleRepo.findByIdForUser(cmd.vehicleId, cmd.userId)
      : await this.vehicleRepo.findByWeaponId(cmd.weaponId, cmd.userId);

    try {
      vehicle.removeWeapon(cmd.weaponId);
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    return this.vehicleRepo.save(vehicle);
  }
}
