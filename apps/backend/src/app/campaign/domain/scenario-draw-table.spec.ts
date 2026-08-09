import { describe, it, expect } from 'vitest';
import { ScenarioDrawTable } from './scenario-draw-table';
import { GameType } from '../game.enums';
import type { IRandomizer } from './randomizer.interface';

/** Randomizer déterministe — implémente IRandomizer sans mocker Math.random. */
class FixedRandomizer implements IRandomizer {
  constructor(private readonly fixedRoll: number) {}
  roll(_sides: number): number { return this.fixedRoll; }
  pick<T>(pool: T[]): T { return pool[0]; }
}

describe('ScenarioDrawTable — tirage D6 (Gaslands p.128-129)', () => {
  describe('Événement Télévisé', () => {
    it.each([
      [1, 'course_a_la_mort'],
      [2, 'course_a_la_mort'],
      [3, 'arene_de_la_mort'],
      [4, 'capture_du_drapeau'],
      [5, 'destruction_de_drapeaux'],
      [6, 'samedi_soir_en_direct'],
    ])('D6=%i → %s', (roll, expected) => {
      const table = new ScenarioDrawTable(new FixedRandomizer(roll));
      expect(table.draw(GameType.EVENEMENT_TELE)).toBe(expected);
    });
  });

  describe('Escarmouche', () => {
    it.each([
      [1, 'operation_ferraille'],
      [2, 'livraison_express'],
      [3, 'chasse_au_matos'],
      [4, 'chasse_au_matos'],
      [5, 'la_revolution_sera_televisee'],
      [6, 'massacre_de_zombies'],
    ])('D6=%i → %s', (roll, expected) => {
      const table = new ScenarioDrawTable(new FixedRandomizer(roll));
      expect(table.draw(GameType.ESCARMOUCHE)).toBe(expected);
    });
  });
});
