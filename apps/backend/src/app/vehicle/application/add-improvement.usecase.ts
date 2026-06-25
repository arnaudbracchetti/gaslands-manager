import { BadRequestException } from '@nestjs/common';
import type { IVehicleRepository } from '../domain/vehicle.repository.interface';
import type { ICatalogRepository } from '../domain/catalog.repository.interface';
import type { Vehicle } from '../domain/vehicle';
import { DomainException } from '../domain/vehicle';
import type { Orientation } from '../vehicle-build';
import type { ImprovementType } from '../domain/value-objects/improvement-type';
import { LogUseCase } from '../log-use-case.decorator';

export interface AddImprovementCommand {
  vehicleId: number;
  nomInterne: string;
  orientation?: Orientation | null;
  userId: number;
}

/**
 * Ajoute une amélioration à un véhicule existant.
 * Remplace VehicleService.addImprovement() et checkCandidate().
 */
export class AddImprovementUseCase {
  constructor(
    private readonly vehicleRepo: IVehicleRepository,
    private readonly catalogRepo: ICatalogRepository,
  ) {}

  @LogUseCase()
  async execute(cmd: AddImprovementCommand): Promise<Vehicle> {
    const vehicle = await this.vehicleRepo.findByIdForUser(cmd.vehicleId, cmd.userId);

    const improvementType = this.catalogRepo.getImprovementType(cmd.nomInterne);
    if (!improvementType) {
      throw new BadRequestException(`Amélioration inconnue du catalogue : "${cmd.nomInterne}"`);
    }

    const authorized = this.catalogRepo.getImprovementTypesForSponsor(vehicle.sponsorNom);
    const isAuthorized = authorized.some((t: ImprovementType) => t.nomInterne === cmd.nomInterne);
    if (!isAuthorized) {
      throw new BadRequestException(
        `L'amélioration "${improvementType.nom}" n'est pas autorisée pour le sponsor "${vehicle.sponsorNom}"`,
      );
    }

    const budget = await this.vehicleRepo.getRemainingBudget(cmd.vehicleId, cmd.userId);

    try {
      vehicle.addImprovement(improvementType, cmd.orientation ?? null, budget);
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    return this.vehicleRepo.save(vehicle);
  }
}
