import type { IVehicleRepository } from '../domain/vehicle.repository.interface';
import type { ICatalogRepository } from '../domain/catalog.repository.interface';
import type { ImprovementType } from '../domain/value-objects/improvement-type';
import type { AvailableImprovementDto } from '../dto/available-improvement.dto';
import { LogUseCase } from '../log-use-case.decorator';

export interface GetAvailableImprovementsQuery {
  vehicleId: number;
  userId: number;
}

/**
 * Retourne la liste des améliorations du sponsor avec un verdict de disponibilité
 * pour chacune — remplace VehicleService.getAvailableImprovements().
 */
export class GetAvailableImprovementsUseCase {
  constructor(
    private readonly vehicleRepo: IVehicleRepository,
    private readonly catalogRepo: ICatalogRepository,
  ) {}

  @LogUseCase()
  async execute(query: GetAvailableImprovementsQuery): Promise<AvailableImprovementDto[]> {
    const vehicle = await this.vehicleRepo.findByIdForUser(query.vehicleId, query.userId);
    const budget = await this.vehicleRepo.getRemainingBudget(query.vehicleId, query.userId);
    const improvementTypes = this.catalogRepo.getImprovementTypesForSponsor(vehicle.sponsorNom);

    return improvementTypes.map((it: ImprovementType): AvailableImprovementDto => {
      const result = vehicle.canAddImprovement(it, null, budget);
      return {
        nom: it.nom,
        nomInterne: it.nomInterne,
        prix: it.hasVariablePrice ? 'x3' : it.price,
        emplacement: it.slots,
        description: it.description,
        regles: it.regles,
        disponible: result.ok,
        raison: result.ok ? undefined : result.reason,
      };
    });
  }
}
