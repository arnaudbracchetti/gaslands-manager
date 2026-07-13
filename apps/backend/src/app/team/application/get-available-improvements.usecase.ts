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
 *
 * Le verdict lui-même (y compris la tolérance à l'orientation d'une amélioration
 * orientée — Bélier…) est une règle métier portée par le domaine, cf.
 * `Vehicle.canAddImprovementInAnyOrientation` : ce use case ne fait qu'orchestrer
 * (charger l'agrégat, itérer le catalogue, mapper vers le DTO).
 */
export class GetAvailableImprovementsUseCase {
  constructor(
    private readonly teamRepo: ITeamRepository,
    private readonly catalogRepo: ICatalogRepository,
  ) {}

  @LogUseCase()
  async execute(query: GetAvailableImprovementsQuery): Promise<AvailableImprovementDto[]> {
    const team = await this.teamRepo.findByVehicleId(query.vehicleId, query.userId);
    const improvementTypes = this.catalogRepo.getImprovementTypesForSponsor(team.sponsor);

    return improvementTypes.map((it: ImprovementType): AvailableImprovementDto => {
      const verdict = team.canAddImprovementToVehicle(query.vehicleId, it);
      return {
        nom: it.nom,
        nomInterne: it.nomInterne,
        prix: it.price,
        emplacement: it.slots,
        description: it.description,
        regles: it.regles,
        disponible: verdict.ok,
        raison: verdict.ok ? undefined : verdict.reason,
      };
    });
  }
}
