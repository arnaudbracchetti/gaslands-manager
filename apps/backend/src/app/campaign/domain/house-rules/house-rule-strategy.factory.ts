import { DomainException } from '../../../shared/domain/domain-exception';
import type { HouseRules } from './house-rules';
import {
  DefaultResistanceStrategy,
  NoChampionshipPointsStrategy,
  type ResistanceDistributionStrategy,
} from './resistance-distribution-strategy';
import { CollectiveTvBonusStrategy, NoTvBonusStrategy, type TvBonusDistributionStrategy } from './tv-bonus-distribution-strategy';
import { DefaultBaseIncomeStrategy, NoBaseIncomeStrategy, type BaseIncomeStrategy } from './base-income-strategy';
import {
  UnlimitedJerricanGainsStrategy,
  CappedJerricanGainsStrategy,
  type JerricanGainsCapStrategy,
} from './jerrican-gains-cap-strategy';

/**
 * Un endroit du code où une règle maison peut changer le calcul par défaut.
 * Chaque point a sa méthode dans la Factory ci-dessous (ex.
 * `createResistanceDistributionStrategy()`). Un nouveau point = une nouvelle
 * valeur ici + une nouvelle méthode, jamais une nouvelle classe Factory.
 */
enum CalculationPoint {
  RESISTANCE_DISTRIBUTION = 'RESISTANCE_DISTRIBUTION',
  TV_BONUS_DISTRIBUTION = 'TV_BONUS_DISTRIBUTION',
  BASE_INCOME_DISTRIBUTION = 'BASE_INCOME_DISTRIBUTION',
  JERRICAN_GAINS_CAP = 'JERRICAN_GAINS_CAP',
}

/**
 * Union discriminée par `point` — chaque point de calcul porte le type de Strategy
 * qui lui est propre. `findActiveOverrides<P>` narrow sur ce discriminant pour que
 * chaque méthode `createXxxStrategy()` récupère une Strategy correctement typée,
 * sans jamais recourir à `any`/un cast.
 */
type HouseRuleOverride =
  | { readonly point: CalculationPoint.RESISTANCE_DISTRIBUTION; readonly strategy: ResistanceDistributionStrategy }
  | { readonly point: CalculationPoint.TV_BONUS_DISTRIBUTION; readonly strategy: TvBonusDistributionStrategy }
  | { readonly point: CalculationPoint.BASE_INCOME_DISTRIBUTION; readonly strategy: BaseIncomeStrategy }
  | { readonly point: CalculationPoint.JERRICAN_GAINS_CAP; readonly strategy: JerricanGainsCapStrategy };

/**
 * Registre pur du domaine — une entrée par règle maison de catalogue qui remplace
 * un calcul par défaut. Même idiome que `IMPROVEMENT_BEHAVIORS`/`ADVANTAGE_BEHAVIORS`
 * (module équipe, cf. ARCHITECTURE.md §3.4) : un Record/Map figé, aucune dépendance
 * de framework.
 */
const HOUSE_RULE_REGISTRY: ReadonlyMap<string, HouseRuleOverride> = new Map<string, HouseRuleOverride>([
  [
    'distribution_points_resistance',
    { point: CalculationPoint.RESISTANCE_DISTRIBUTION, strategy: new NoChampionshipPointsStrategy() },
  ],
  [
    'cagnotte_collective_evenement_tele',
    { point: CalculationPoint.TV_BONUS_DISTRIBUTION, strategy: new CollectiveTvBonusStrategy() },
  ],
  [
    'escarmouche_bonus_jerricans',
    { point: CalculationPoint.BASE_INCOME_DISTRIBUTION, strategy: new NoBaseIncomeStrategy() },
  ],
  [
    'plafond_jerricans_escarmouche',
    { point: CalculationPoint.JERRICAN_GAINS_CAP, strategy: new CappedJerricanGainsStrategy() },
  ],
]);

const DEFAULT_RESISTANCE_STRATEGY = new DefaultResistanceStrategy();
const DEFAULT_TV_BONUS_STRATEGY = new NoTvBonusStrategy();
const DEFAULT_BASE_INCOME_STRATEGY = new DefaultBaseIncomeStrategy();
const DEFAULT_JERRICAN_GAINS_CAP_STRATEGY = new UnlimitedJerricanGainsStrategy();

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

  /** Résout la Strategy de la cagnotte collective de fin d'Événement Télévisé —
   *  `NoTvBonusStrategy` (personne n'est crédité) si aucune règle maison active. */
  createTvBonusDistributionStrategy(): TvBonusDistributionStrategy {
    const active = this.findActiveOverrides(CalculationPoint.TV_BONUS_DISTRIBUTION);
    if (active.length > 1) {
      throw new DomainException(
        'Plusieurs règles maison actives distribuent la cagnotte télé — une seule à la fois.',
      );
    }
    return active[0]?.strategy ?? DEFAULT_TV_BONUS_STRATEGY;
  }

  /** Résout la Strategy du revenu de base d'une Escarmouche —
   *  `DefaultBaseIncomeStrategy` (1D6) si aucune règle maison active. */
  createBaseIncomeStrategy(): BaseIncomeStrategy {
    const active = this.findActiveOverrides(CalculationPoint.BASE_INCOME_DISTRIBUTION);
    if (active.length > 1) {
      throw new DomainException(
        'Plusieurs règles maison actives résolvent le revenu de base — une seule à la fois.',
      );
    }
    return active[0]?.strategy ?? DEFAULT_BASE_INCOME_STRATEGY;
  }

  /** Résout la Strategy de plafond des gains de jerricans en Escarmouche —
   *  `UnlimitedJerricanGainsStrategy` (aucun plafond) si aucune règle maison active. */
  createJerricanGainsCapStrategy(): JerricanGainsCapStrategy {
    const active = this.findActiveOverrides(CalculationPoint.JERRICAN_GAINS_CAP);
    if (active.length > 1) {
      throw new DomainException(
        'Plusieurs règles maison actives plafonnent les gains de jerricans — une seule à la fois.',
      );
    }
    return active[0]?.strategy ?? DEFAULT_JERRICAN_GAINS_CAP_STRATEGY;
  }

  private findActiveOverrides<P extends CalculationPoint>(
    point: P,
  ): Extract<HouseRuleOverride, { point: P }>[] {
    return [...HOUSE_RULE_REGISTRY.entries()]
      .filter(
        (entry): entry is [string, Extract<HouseRuleOverride, { point: P }>] =>
          entry[1].point === point && this.rules.isEnabled(entry[0]),
      )
      .map(([, override]) => override);
  }
}
