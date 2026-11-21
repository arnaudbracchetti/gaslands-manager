import { describe, it, expect } from 'vitest';
import {
  UnlimitedJerricanGainsStrategy,
  CappedJerricanGainsStrategy,
  JERRICAN_GAINS_CAP_AMOUNT,
} from './jerrican-gains-cap-strategy';

describe('UnlimitedJerricanGainsStrategy', () => {
  it('ne réduit jamais le montant demandé, quel que soit le cumul déjà gagné', () => {
    const strategy = new UnlimitedJerricanGainsStrategy();

    expect(strategy.clamp(6, 0)).toBe(6);
    expect(strategy.clamp(6, 100)).toBe(6);
    expect(strategy.key).toBe('defaut');
  });
});

describe('CappedJerricanGainsStrategy', () => {
  it('crédite le montant intégral si le cumul reste sous le plafond', () => {
    const strategy = new CappedJerricanGainsStrategy();

    expect(strategy.clamp(6, 0)).toBe(6);
    expect(strategy.key).toBe('plafond_jerricans_escarmouche');
  });

  it('réduit le montant au reliquat exact quand le cumul + la demande dépasse le plafond', () => {
    const strategy = new CappedJerricanGainsStrategy();

    // Déjà 10 gagnés, demande 8 → seul le reliquat (15 - 10 = 5) est crédité.
    expect(strategy.clamp(8, 10)).toBe(5);
  });

  it('ne crédite rien si le cumul a déjà atteint le plafond', () => {
    const strategy = new CappedJerricanGainsStrategy();

    expect(strategy.clamp(6, JERRICAN_GAINS_CAP_AMOUNT)).toBe(0);
  });

  it('ne crédite rien si le cumul dépasse déjà le plafond', () => {
    const strategy = new CappedJerricanGainsStrategy();

    expect(strategy.clamp(6, JERRICAN_GAINS_CAP_AMOUNT + 5)).toBe(0);
  });

  it('crédite exactement jusqu\'au plafond quand la demande dépasse le reliquat disponible', () => {
    const strategy = new CappedJerricanGainsStrategy();

    expect(strategy.clamp(20, 0)).toBe(JERRICAN_GAINS_CAP_AMOUNT);
  });
});
