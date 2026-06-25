import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { IVehicleRepository } from '../domain/vehicle.repository.interface';
import type { ICatalogRepository } from '../domain/catalog.repository.interface';
import type { Vehicle } from '../domain/vehicle';
import { DomainException } from '../domain/vehicle';
import { LogUseCase } from '../log-use-case.decorator';

export interface RemoveImprovementCommand {
  vehicleId: number;
  improvementId: number;
  userId: number;
}

/**
 * Retire une amélioration achetée d'un véhicule.
 * Remplace VehicleService.removeImprovement().
 * Traduit DomainException en ForbiddenException pour les améliorations par défaut,
 * et en BadRequestException pour les autres erreurs métier.
 */
export class RemoveImprovementUseCase {
  constructor(
    private readonly vehicleRepo: IVehicleRepository,
    private readonly catalogRepo: ICatalogRepository,
  ) {}

  @LogUseCase()
  async execute(cmd: RemoveImprovementCommand): Promise<Vehicle> {
    const vehicle = await this.vehicleRepo.findByIdForUser(cmd.vehicleId, cmd.userId);

    // Vérifier si c'est une amélioration par défaut avant de déléguer à l'agrégat,
    // pour distinguer ForbiddenException (interdit) de BadRequestException (introuvable).
    const imp = vehicle.improvements.find((i) => i.id === cmd.improvementId);
    if (!imp) {
      throw new BadRequestException(
        `Amélioration #${cmd.improvementId} introuvable sur le véhicule #${cmd.vehicleId}`,
      );
    }
    if (imp.estDefaut) {
      throw new ForbiddenException(
        `"${imp.type.nomInterne}" fait partie du profil de base de ce véhicule et ne peut pas être retirée.`,
      );
    }

    try {
      vehicle.removeImprovement(cmd.improvementId);
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    return this.vehicleRepo.save(vehicle);
  }
}
