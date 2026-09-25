import { describe, it, expect } from 'vitest';
import {
  DefaultResistanceStrategy,
  NoChampionshipPointsStrategy,
  type ResistanceEntry,
} from './resistance-distribution-strategy';

function makeEntry(overrides: Partial<ResistanceEntry> = {}): ResistanceEntry {
  return { participantId: 1, rank: 1, championshipPointsThisGame: 0, ...overrides };
}

describe('DefaultResistanceStrategy', () => {
  const strategy = new DefaultResistanceStrategy();

  it("porte la clé 'defaut'", () => {
    expect(strategy.key).toBe('defaut');
  });

  it('éligible si le rang est hors de la moitié classée', () => {
    expect(strategy.isEligible(makeEntry({ rank: 3 }), { classified: 2 })).toBe(true);
  });

  it("n'est pas éligible si le rang fait partie de la moitié classée", () => {
    expect(strategy.isEligible(makeEntry({ rank: 2 }), { classified: 2 })).toBe(false);
  });

  it('ignore le total de PC de la partie — seul le rang compte', () => {
    expect(strategy.isEligible(makeEntry({ rank: 3, championshipPointsThisGame: 10 }), { classified: 2 })).toBe(
      true,
    );
  });
});

describe('NoChampionshipPointsStrategy (R1)', () => {
  const strategy = new NoChampionshipPointsStrategy();

  it("porte la clé 'resistance_sans_points_championnat'", () => {
    expect(strategy.key).toBe('resistance_sans_points_championnat');
  });

  it('éligible si le total de PC de la partie vaut zéro, peu importe le rang', () => {
    expect(strategy.isEligible(makeEntry({ rank: 1, championshipPointsThisGame: 0 }), { classified: 2 })).toBe(
      true,
    );
  });

  it("n'est pas éligible dès que le total de PC est non nul, même classé dernier", () => {
    expect(strategy.isEligible(makeEntry({ rank: 5, championshipPointsThisGame: 3 }), { classified: 2 })).toBe(
      false,
    );
  });

  it('ignore le rang — seul le total de PC compte', () => {
    expect(strategy.isEligible(makeEntry({ rank: 1, championshipPointsThisGame: 10 }), { classified: 2 })).toBe(
      false,
    );
  });
});
