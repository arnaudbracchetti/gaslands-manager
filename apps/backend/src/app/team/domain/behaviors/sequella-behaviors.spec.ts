import { describe, it, expect } from 'vitest';
import { SEQUELLA_BEHAVIORS, resolveSequellaBehavior } from './sequella-behaviors';
import type { VehicleStats } from './equipment-behavior';

/** Fabrique un `VehicleStats` avec des valeurs contrôlées pour les tests. */
function makeStats(overrides: Partial<VehicleStats> = {}): VehicleStats {
  return {
    nom_interne: 'voiture', poids: 'Moyen',
    carrosserie: 6, manoeuvrabilite: 4, vitesse_max: 6, equipage: 2,
    ...overrides,
  };
}

describe('SiegeIrrecuperableBehavior (siege_irrecuperable)', () => {
  it('réduit equipage de 1', () => {
    const behavior = resolveSequellaBehavior('siege_irrecuperable');
    expect(behavior.applyStats(makeStats({ equipage: 2 })).equipage).toBe(1);
  });

  it('ne descend pas sous 1', () => {
    const behavior = resolveSequellaBehavior('siege_irrecuperable');
    expect(behavior.applyStats(makeStats({ equipage: 1 })).equipage).toBe(1);
  });
});

describe('resolveSequellaBehavior — fallback neutre', () => {
  it('une séquelle sans effet chiffré (ex. "suicidaire") ne modifie aucune stat', () => {
    const behavior = resolveSequellaBehavior('suicidaire');
    const stats = makeStats();
    expect(behavior.applyStats(stats)).toEqual(stats);
  });
});

describe('SEQUELLA_BEHAVIORS', () => {
  it('contient uniquement l\'entrée à effet chiffré (siege_irrecuperable)', () => {
    expect(SEQUELLA_BEHAVIORS.has('siege_irrecuperable')).toBe(true);
    expect(SEQUELLA_BEHAVIORS.size).toBe(1);
  });
});
