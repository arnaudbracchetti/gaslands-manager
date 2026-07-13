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

describe('MoteurEndommageBehavior (moteur_endommage)', () => {
  it('réduit vitesse_max de 1', () => {
    const behavior = resolveSequellaBehavior('moteur_endommage');
    expect(behavior.applyStats(makeStats({ vitesse_max: 6 })).vitesse_max).toBe(5);
  });

  it('ne descend pas sous 1 (vitesse minimum)', () => {
    const behavior = resolveSequellaBehavior('moteur_endommage');
    expect(behavior.applyStats(makeStats({ vitesse_max: 1 })).vitesse_max).toBe(1);
  });

  it('ne modifie pas les autres stats', () => {
    const behavior = resolveSequellaBehavior('moteur_endommage');
    const result = behavior.applyStats(makeStats());
    expect(result.carrosserie).toBe(6);
    expect(result.manoeuvrabilite).toBe(4);
  });
});

describe('DirectionEndommageBehavior (direction_endommage)', () => {
  it('réduit manoeuvrabilite de 1', () => {
    const behavior = resolveSequellaBehavior('direction_endommage');
    expect(behavior.applyStats(makeStats({ manoeuvrabilite: 4 })).manoeuvrabilite).toBe(3);
  });

  it('ne descend pas sous 1', () => {
    const behavior = resolveSequellaBehavior('direction_endommage');
    expect(behavior.applyStats(makeStats({ manoeuvrabilite: 1 })).manoeuvrabilite).toBe(1);
  });
});

describe('BlindageArracheBehavior (blindage_arrache)', () => {
  it('réduit carrosserie de 2', () => {
    const behavior = resolveSequellaBehavior('blindage_arrache');
    expect(behavior.applyStats(makeStats({ carrosserie: 6 })).carrosserie).toBe(4);
  });

  it('ne descend pas sous 0', () => {
    const behavior = resolveSequellaBehavior('blindage_arrache');
    expect(behavior.applyStats(makeStats({ carrosserie: 1 })).carrosserie).toBe(0);
  });
});

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
  it('contient les 4 entrées à effet chiffré', () => {
    expect(SEQUELLA_BEHAVIORS.has('moteur_endommage')).toBe(true);
    expect(SEQUELLA_BEHAVIORS.has('direction_endommage')).toBe(true);
    expect(SEQUELLA_BEHAVIORS.has('blindage_arrache')).toBe(true);
    expect(SEQUELLA_BEHAVIORS.has('siege_irrecuperable')).toBe(true);
  });

  it('les séquelles se composent correctement (fold successif, plus de chaînage)', () => {
    const stats = makeStats({ vitesse_max: 6, manoeuvrabilite: 4 });
    const apresMoteur = resolveSequellaBehavior('moteur_endommage').applyStats(stats);
    const apresDirection = resolveSequellaBehavior('direction_endommage').applyStats(apresMoteur);
    expect(apresDirection.vitesse_max).toBe(5);
    expect(apresDirection.manoeuvrabilite).toBe(3);
  });
});
