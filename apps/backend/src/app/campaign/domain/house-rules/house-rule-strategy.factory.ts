import { DomainException } from '../../../shared/domain/domain-exception';
import type { HouseRules } from './house-rules';
import {
  DefaultResistanceStrategy,
  NoChampionshipPointsStrategy,
  type ResistanceDistributionStrategy,
} from './resistance-distribution-strategy';

/**
 * Un endroit du code où une règle maison peut changer le calcul par défaut.
 * Aujourd'hui il n'y en a qu'un : la distribution des Points de Résistance.
 * Chaque point a sa méthode dans la Factory ci-dessous (ex.
 * `createResistanceDistributionStrategy()`). Un nouveau point = une nouvelle
 * valeur ici + une nouvelle méthode, jamais une nouvelle classe Factory.
 */
enum CalculationPoint {
  RESISTANCE_DISTRIBUTION = 'RESISTANCE_DISTRIBUTION',
}

interface HouseRuleOverride {
  readonly point: CalculationPoint;
  readonly strategy: ResistanceDistributionStrategy;
}

/**
 * Registre pur du domaine — une entrée par règle maison de catalogue qui remplace
 * un calcul par défaut. Même idiome que `IMPROVEMENT_BEHAVIORS`/`ADVANTAGE_BEHAVIORS`
 * (module équipe, cf. ARCHITECTURE.md §3.4) : un Record/Map figé, aucune dépendance
 * de framework. Première (et pour l'instant unique) entrée : R1 (RM-5), cf.
 * docs/plans/2026-09-21-regles-maison-mecanisme-design.md.
 */
const HOUSE_RULE_REGISTRY: ReadonlyMap<string, HouseRuleOverride> = new Map<string, HouseRuleOverride>([
  [
    'resistance_sans_points_championnat',
    { point: CalculationPoint.RESISTANCE_DISTRIBUTION, strategy: new NoChampionshipPointsStrategy() },
  ],
]);

const DEFAULT_RESISTANCE_STRATEGY = new DefaultResistanceStrategy();

/**
 * Abstract Factory **unique** pour toutes les règles maison — une méthode de
 * création par point de calcul concerné (`createResistanceDistributionStrategy()`
 * aujourd'hui, une méthode de plus par point futur), jamais une Factory par règle
 * ni par point. Construite à partir du `HouseRules` d'une campagne (cf.
 * `Campaign.strategyFactory`) — jamais choisie par un appelant extérieur au
 * domaine : cf. skill `ddd`, theory/aggregate-design.md, « Qui sélectionne une
 * Strategy ? ».
 *
 * Pure — aucune dépendance de framework (règle transversale 4 du skill `ddd`).
 */
export class HouseRuleStrategyFactory {
  constructor(private readonly rules: HouseRules) {}

  /** Résout la Strategy de distribution des Points de Résistance (US-F1) —
   *  `DefaultResistanceStrategy` si aucune règle maison de ce point n'est active. */
  createResistanceDistributionStrategy(): ResistanceDistributionStrategy {
    const active = this.findActiveOverrides(CalculationPoint.RESISTANCE_DISTRIBUTION);
    if (active.length > 1) {
      throw new DomainException(
        'Plusieurs règles maison actives distribuent les Points de Résistance — une seule à la fois.',
      );
    }
    return active[0]?.strategy ?? DEFAULT_RESISTANCE_STRATEGY;
  }

  private findActiveOverrides(point: CalculationPoint): HouseRuleOverride[] {
    return [...HOUSE_RULE_REGISTRY.entries()]
      .filter(([key, override]) => override.point === point && this.rules.isEnabled(key))
      .map(([, override]) => override);
  }
}
