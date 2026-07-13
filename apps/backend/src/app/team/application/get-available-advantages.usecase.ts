import type { ITeamRepository } from '../domain/team.repository.interface';
import type { ICatalogRepository } from '../domain/catalog.repository.interface';
import type { AdvantageType } from '../domain/value-objects/advantage-type';
import type { AvailableAdvantageDto } from '../dto/available-advantage.dto';
import { LogUseCase } from '../log-use-case.decorator';

export interface GetAvailableAdvantagesQuery {
  vehicleId: number;
  userId: number;
}

/**
 * Retourne la liste des avantages du sponsor (les 12 avantages des 2 catégories
 * `classes_avantage` de ce sponsor) avec un verdict de disponibilité.
 *
 * Miroir de `GetAvailableImprovementsUseCase` : le verdict (budget, unicité, et les 2
 * restrictions Cascadeur/Sur Deux Roues) est une règle métier portée par le domaine
 * (`Vehicle.canAddAdvantage`) — ce use case ne fait qu'orchestrer. Pas de variante
 * "InAnyOrientation" : un avantage ne demande jamais d'orientation.
 */
export class GetAvailableAdvantagesUseCase {
  constructor(
    private readonly teamRepo: ITeamRepository,
    private readonly catalogRepo: ICatalogRepository,
  ) {}

  @LogUseCase()
  async execute(query: GetAvailableAdvantagesQuery): Promise<AvailableAdvantageDto[]> {
    const team = await this.teamRepo.findByVehicleId(query.vehicleId, query.userId);
    const advantageTypes = this.catalogRepo.getAdvantageTypesForSponsor(team.sponsor);

    return advantageTypes.map((at: AdvantageType): AvailableAdvantageDto => {
      const verdict = team.canAddAdvantageToVehicle(query.vehicleId, at);
      return {
        nom: at.nom,
        nomInterne: at.nomInterne,
        categorie: at.categorie,
        prix: at.price,
        description: at.description,
        regles: at.regles,
        disponible: verdict.ok,
        raison: verdict.ok ? undefined : verdict.reason,
      };
    });
  }
}
