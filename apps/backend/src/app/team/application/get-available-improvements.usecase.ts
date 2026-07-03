import type { ITeamRepository } from '../domain/team.repository.interface';
import type { ICatalogRepository } from '../domain/catalog.repository.interface';
import type { ImprovementType } from '../domain/value-objects/improvement-type';
import type { Vehicle } from '../domain/vehicle';
import type { Orientation, RuleResult } from '../domain/team';
import type { AvailableImprovementDto } from '../dto/available-improvement.dto';
import { LogUseCase } from '../log-use-case.decorator';

export interface GetAvailableImprovementsQuery {
  vehicleId: number;
  userId: number;
}

/**
 * Arcs testés pour le verdict de disponibilité d'une amélioration orientée (Bélier…).
 * Le catalogue ignore encore l'orientation choisie (elle l'est à l'ajout, via
 * `EquipmentOption`) : une amélioration orientée est donc proposée dès qu'AU MOINS un
 * arc est libre — grisée avec la raison de blocage seulement si tous sont pris.
 */
const AVAILABILITY_PROBE_ORIENTATIONS: readonly Orientation[] = ['avant', 'arrière', 'gauche', 'droite'];

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
      const verdict = this.evaluateAvailability(vehicle, it, budget);
      return {
        nom: it.nom,
        nomInterne: it.nomInterne,
        prix: it.hasVariablePrice ? 'x3' : it.price,
        emplacement: it.slots,
        description: it.description,
        regles: it.regles,
        disponible: verdict.ok,
        raison: verdict.ok ? undefined : verdict.reason,
      };
    });
  }

  /**
   * Verdict de disponibilité tolérant à l'orientation : on tente d'abord sans arc
   * (`null`). Si l'ajout échoue — potentiellement à cause du seul « orientation requise »
   * pour un Bélier —, on retente chaque arc et l'amélioration reste disponible dès qu'un
   * arc valide. Les autres règles de pose (incompatibilité véhicule, unicité, équipage
   * max…) grisent bien l'option puisqu'elles échouent quel que soit l'arc.
   */
  private evaluateAvailability(vehicle: Vehicle, it: ImprovementType, budget: number): RuleResult {
    const direct = vehicle.canAddImprovement(it, null, budget);
    if (direct.ok) return direct;

    let last: RuleResult = direct;
    for (const orientation of AVAILABILITY_PROBE_ORIENTATIONS) {
      const result = vehicle.canAddImprovement(it, orientation, budget);
      if (result.ok) return result;
      last = result;
    }
    return last;
  }
}
