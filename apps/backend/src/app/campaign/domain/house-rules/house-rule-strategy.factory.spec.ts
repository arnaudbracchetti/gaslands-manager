import { describe, it, expect } from 'vitest';
import { HouseRuleStrategyFactory } from './house-rule-strategy.factory';
import { HouseRules } from './house-rules';
import { DefaultResistanceStrategy, NoChampionshipPointsStrategy } from './resistance-distribution-strategy';

describe('HouseRuleStrategyFactory', () => {
  it('résout la Strategy par défaut quand aucune règle maison n\'est active', () => {
    const factory = new HouseRuleStrategyFactory(HouseRules.none());

    const strategy = factory.createResistanceDistributionStrategy();

    expect(strategy).toBeInstanceOf(DefaultResistanceStrategy);
    expect(strategy.key).toBe('defaut');
  });

  it('résout la Strategy par défaut quand une clé active n\'a aucune entrée dans le registre', () => {
    const factory = new HouseRuleStrategyFactory(HouseRules.fromPersisted(['clef_inconnue_du_registre']));

    const strategy = factory.createResistanceDistributionStrategy();

    expect(strategy).toBeInstanceOf(DefaultResistanceStrategy);
  });

  it('résout NoChampionshipPointsStrategy (R1) quand resistance_sans_points_championnat est active', () => {
    const factory = new HouseRuleStrategyFactory(HouseRules.fromPersisted(['resistance_sans_points_championnat']));

    const strategy = factory.createResistanceDistributionStrategy();

    expect(strategy).toBeInstanceOf(NoChampionshipPointsStrategy);
    expect(strategy.key).toBe('resistance_sans_points_championnat');
  });

  it('résout la Strategy par défaut quand resistance_sans_points_championnat existe mais est désactivée', () => {
    const factory = new HouseRuleStrategyFactory(HouseRules.fromPersisted([]));

    const strategy = factory.createResistanceDistributionStrategy();

    expect(strategy).toBeInstanceOf(DefaultResistanceStrategy);
  });

  // "Deux règles actives sur le même point → DomainException" : non testable
  // aujourd'hui sans donnée artificielle — le registre réel n'a qu'une seule
  // entrée pour RESISTANCE_DISTRIBUTION tant qu'une seconde règle maison ne
  // vient pas le concurrencer. La garde existe et sera exercée par le spec de
  // cette future règle.
});
