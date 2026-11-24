import { describe, it, expect } from 'vitest';
import { ScenarioDrawTable } from './scenario-draw-table';
import type { IRandomizer } from './randomizer.interface';

/** Randomizer déterministe - mémorise le nombre de faces demandé. */
class FixedRandomizer implements IRandomizer {
  lastSides: number | undefined;
  constructor(private readonly fixedRoll: number) {}
  roll(sides: number): number {
    this.lastSides = sides;
    return this.fixedRoll;
  }
  pick<T>(pool: T[]): T {
    return pool[0];
  }
}

const candidat = (
  id: string,
  poids_tirage: number,
): { id: string; poids_tirage: number } => ({ id, poids_tirage });

describe('ScenarioDrawTable - tirage pondéré par poids_tirage', () => {
  const candidats = [candidat('A', 1), candidat('B', 2), candidat('C', 1)];

  it('lance un dé dont le nombre de faces est la somme des poids', () => {
    const random = new FixedRandomizer(1);
    new ScenarioDrawTable(random).draw(candidats);
    expect(random.lastSides).toBe(4);
  });

  it.each([
    [1, 'A'],
    [2, 'B'],
    [3, 'B'],
    [4, 'C'],
  ])('jet %i → %s (un poids 2 occupe deux faces)', (jet, attendu) => {
    const table = new ScenarioDrawTable(new FixedRandomizer(jet));
    expect(table.draw(candidats).id).toBe(attendu);
  });

  it('ne tire jamais un candidat de poids 0', () => {
    const avecZero = [candidat('A', 1), candidat('ZERO', 0), candidat('C', 1)];
    expect(
      new ScenarioDrawTable(new FixedRandomizer(1)).draw(avecZero).id,
    ).toBe('A');
    expect(
      new ScenarioDrawTable(new FixedRandomizer(2)).draw(avecZero).id,
    ).toBe('C');
  });

  it('refuse un tirage sans candidat de poids non nul', () => {
    const table = new ScenarioDrawTable(new FixedRandomizer(1));
    expect(() => table.draw([candidat('ZERO', 0)])).toThrow(/aucun candidat/);
    expect(() => table.draw([])).toThrow(/aucun candidat/);
  });
});
