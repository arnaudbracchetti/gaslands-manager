import type { IVehicleRepository } from '../domain/vehicle.repository.interface';
import type { ICatalogRepository } from '../domain/catalog.repository.interface';
import { LogUseCase } from '../log-use-case.decorator';

export interface RemoveVehicleCommand {
  vehicleId: number;
  userId: number;
}

/** Supprime un véhicule et tout son équipement (cascade). Remplace VehicleService.remove(). */
export class RemoveVehicleUseCase {
  constructor(
    private readonly vehicleRepo: IVehicleRepository,
    private readonly catalogRepo: ICatalogRepository,
  ) {}

  @LogUseCase()
  async execute(cmd: RemoveVehicleCommand): Promise<void> {
    await this.vehicleRepo.remove(cmd.vehicleId, cmd.userId);
  }
}
