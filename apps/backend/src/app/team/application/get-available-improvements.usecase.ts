import type { ITeamRepository } from '../domain/team.repository.interface';
import type { ICatalogRepository } from '../domain/catalog.repository.interface';
import type { ImprovementType } from '../domain/value-objects/improvement-type';
import type { AvailableImprovementDto } from '../dto/available-improvement.dto';
import { LogUseCase } from '../log-use-case.decorator';

export interface GetAvailableImprovementsQuery {
  vehicleId: number;
  userId: number;
}

/**
 * Retourne la liste des améliorations du sponsor avec un verdict de disponibilité.
 */
export class GetAvailableImprovementsUseCase {
  constructor(
    private readonly teamRepo: ITeamRepository,
    private readonly catalogRepo: ICatalogRepository,
  ) {}

  @LogUseCase()
  async execute(query: GetAvailableImprovementsQuery): Promise<AvailableImprovementDto[]> {
    const team = await this.teamRepo.findByVehicleId(query.vehicleId, query.userId);
    const vehicle = team.findVehicle(query.vehicleId);
    const budget = team.remainingBudget;
    const improvementTypes = this.catalogRepo.getImprovementTypesForSponsor(team.sponsor);

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
