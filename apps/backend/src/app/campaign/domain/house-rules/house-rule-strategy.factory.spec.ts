import { describe, it, expect } from 'vitest';
import { HouseRuleStrategyFactory } from './house-rule-strategy.factory';
import { HouseRules } from './house-rules';
import { DefaultResistanceStrategy } from './resistance-distribution-strategy';

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

  // Le registre est vide tant que RM-5 n'a pas ajouté sa première règle maison
  // (resistance_sans_points_championnat) — les cas "une règle active remplace le
  // défaut" et "deux règles actives sur le même point lèvent une DomainException"
  // seront couverts par le spec de RM-5, contre une entrée réelle du registre.
});
