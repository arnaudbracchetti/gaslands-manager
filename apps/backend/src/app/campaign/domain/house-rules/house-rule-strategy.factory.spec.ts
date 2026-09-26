import { describe, it, expect } from 'vitest';
import { HouseRuleStrategyFactory } from './house-rule-strategy.factory';
import { HouseRules } from './house-rules';
import { DefaultResistanceStrategy, NoChampionshipPointsStrategy } from './resistance-distribution-strategy';
import { CollectiveTvBonusStrategy, NoTvBonusStrategy } from './tv-bonus-distribution-strategy';

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

  it('résout NoChampionshipPointsStrategy (R1) quand distribution_points_resistance est active', () => {
    const factory = new HouseRuleStrategyFactory(HouseRules.fromPersisted(['distribution_points_resistance']));

    const strategy = factory.createResistanceDistributionStrategy();

    expect(strategy).toBeInstanceOf(NoChampionshipPointsStrategy);
    expect(strategy.key).toBe('distribution_points_resistance');
  });

  it('résout la Strategy par défaut quand distribution_points_resistance existe mais est désactivée', () => {
    const factory = new HouseRuleStrategyFactory(HouseRules.fromPersisted([]));

    const strategy = factory.createResistanceDistributionStrategy();

    expect(strategy).toBeInstanceOf(DefaultResistanceStrategy);
  });

  // "Deux règles actives sur le même point → DomainException" : non testable
  // aujourd'hui sans donnée artificielle — le registre réel n'a qu'une seule
  // entrée pour RESISTANCE_DISTRIBUTION tant qu'une seconde règle maison ne
  // vient pas le concurrencer. La garde existe et sera exercée par le spec de
  // cette future règle. `cagnotte_collective_evenement_tele` (ci-dessous) cible
  // un point de calcul différent (TV_BONUS_DISTRIBUTION), donc ne lève toujours
  // pas ce conflit — reste vrai tant qu'une seconde règle ne vient pas
  // concurrencer CE point-là.

  it('résout la Strategy par défaut (cagnotte télé) quand aucune règle maison n\'est active', () => {
    const factory = new HouseRuleStrategyFactory(HouseRules.none());

    const strategy = factory.createTvBonusDistributionStrategy();

    expect(strategy).toBeInstanceOf(NoTvBonusStrategy);
    expect(strategy.key).toBe('defaut');
  });

  it('résout CollectiveTvBonusStrategy quand cagnotte_collective_evenement_tele est active', () => {
    const factory = new HouseRuleStrategyFactory(HouseRules.fromPersisted(['cagnotte_collective_evenement_tele']));

    const strategy = factory.createTvBonusDistributionStrategy();

    expect(strategy).toBeInstanceOf(CollectiveTvBonusStrategy);
    expect(strategy.key).toBe('cagnotte_collective_evenement_tele');
  });

  it('résout la Strategy par défaut (cagnotte télé) quand cagnotte_collective_evenement_tele existe mais est désactivée', () => {
    const factory = new HouseRuleStrategyFactory(HouseRules.fromPersisted([]));

    const strategy = factory.createTvBonusDistributionStrategy();

    expect(strategy).toBeInstanceOf(NoTvBonusStrategy);
  });

  it('active distribution_points_resistance sans effet sur la Strategy de cagnotte télé', () => {
    const factory = new HouseRuleStrategyFactory(HouseRules.fromPersisted(['distribution_points_resistance']));

    expect(factory.createTvBonusDistributionStrategy()).toBeInstanceOf(NoTvBonusStrategy);
  });
});
