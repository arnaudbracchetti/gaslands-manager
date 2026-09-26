import { describe, it, expect } from 'vitest';
import {
  CollectiveTvBonusStrategy,
  NoTvBonusStrategy,
  TV_BONUS_AMOUNT_JERRICANS,
  type TvBonusEntry,
} from './tv-bonus-distribution-strategy';

function makeEntry(overrides: Partial<TvBonusEntry> = {}): TvBonusEntry {
  return { participantId: 1, ...overrides };
}

describe('NoTvBonusStrategy', () => {
  const strategy = new NoTvBonusStrategy();

  it("porte la clé 'defaut'", () => {
    expect(strategy.key).toBe('defaut');
  });

  it("n'est jamais éligible, quel que soit le participant", () => {
    expect(strategy.isEligible(makeEntry({ participantId: 1 }))).toBe(false);
    expect(strategy.isEligible(makeEntry({ participantId: 999 }))).toBe(false);
  });
});

describe('CollectiveTvBonusStrategy', () => {
  const strategy = new CollectiveTvBonusStrategy();

  it("porte la clé 'cagnotte_collective_evenement_tele'", () => {
    expect(strategy.key).toBe('cagnotte_collective_evenement_tele');
  });

  it('est toujours éligible, quel que soit le participant', () => {
    expect(strategy.isEligible(makeEntry({ participantId: 1 }))).toBe(true);
    expect(strategy.isEligible(makeEntry({ participantId: 999 }))).toBe(true);
  });
});

describe('TV_BONUS_AMOUNT_JERRICANS', () => {
  it('vaut 5 jerricans', () => {
    expect(TV_BONUS_AMOUNT_JERRICANS).toBe(5);
  });
});
