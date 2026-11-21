import { describe, it, expect } from 'vitest';
import { DefaultBaseIncomeStrategy, NoBaseIncomeStrategy } from './base-income-strategy';
import type { IRandomizer } from '../randomizer.interface';

const randomizer: IRandomizer = {
  roll: (): number => 4,
  pick: <T>(pool: T[]): T => pool[0],
};

describe('DefaultBaseIncomeStrategy', () => {
  it('délègue le tirage à IRandomizer.roll(6)', () => {
    const strategy = new DefaultBaseIncomeStrategy();

    expect(strategy.roll(randomizer)).toBe(4);
    expect(strategy.key).toBe('defaut');
  });
});

describe('NoBaseIncomeStrategy', () => {
  it('ne tire jamais — retourne toujours null, quel que soit le randomizer', () => {
    const strategy = new NoBaseIncomeStrategy();

    expect(strategy.roll(randomizer)).toBeNull();
    expect(strategy.key).toBe('escarmouche_bonus_jerricans');
  });
});
