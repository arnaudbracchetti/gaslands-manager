import { describe, it, expect } from 'vitest';
import { Improvement } from './improvement';
import { ImprovementType } from './value-objects/improvement-type';

function makeImprovementType(prix: number, emplacement: number): ImprovementType {
  return ImprovementType.from({
    nom: 'Blindage', nom_interne: 'blindage',
    prix, emplacement, description: '', regles: '', sponsors_autorises: [],
  });
}

describe('Improvement', () => {
  describe('slots', () => {
    it('retourne le nombre d\'emplacements du catalogue quand elle n\'est ni perdue ni par défaut', () => {
      const improvement = new Improvement(1, makeImprovementType(4, 1), null, false);
      expect(improvement.slots).toBe(1);
    });

    it('retourne 0 si l\'amélioration est perdue — emplacement libéré (règle campagne)', () => {
      const improvement = new Improvement(1, makeImprovementType(4, 1), null, false);
      improvement.markLost();
      expect(improvement.slots).toBe(0);
    });

    it('retourne 0 si estDefaut, même sans être perdue', () => {
      const improvement = new Improvement(1, makeImprovementType(4, 1), null, true);
      expect(improvement.slots).toBe(0);
    });
  });

  describe('price', () => {
    it('est inchangé même si l\'amélioration est perdue — pas de remboursement', () => {
      const improvement = new Improvement(1, makeImprovementType(4, 1), null, false);
      improvement.markLost();
      expect(improvement.price).toBe(4);
    });

    it('devient le prix résiduel (ceil(X/2)) une fois vendue', () => {
      const improvement = new Improvement(1, makeImprovementType(4, 1), null, false);
      improvement.markSold();
      expect(improvement.price).toBe(2); // ceil(4/2) = 2
    });

    it('reste 0 pour une amélioration estDefaut, même marquée vendue', () => {
      const improvement = new Improvement(1, makeImprovementType(4, 1), null, true);
      improvement.markSold();
      expect(improvement.price).toBe(0);
    });
  });

  describe('markLost / clearLost', () => {
    it('isLost est false par défaut', () => {
      const improvement = new Improvement(1, makeImprovementType(4, 1), null, false);
      expect(improvement.isLost).toBe(false);
    });

    it('markLost est idempotent — deux appels successifs ne causent pas d\'erreur', () => {
      const improvement = new Improvement(1, makeImprovementType(4, 1), null, false);
      improvement.markLost();
      improvement.markLost();
      expect(improvement.isLost).toBe(true);
      expect(improvement.slots).toBe(0);
    });

    it('clearLost remet l\'amélioration à l\'état actif', () => {
      const improvement = new Improvement(1, makeImprovementType(4, 1), null, false);
      improvement.markLost();
      improvement.clearLost();
      expect(improvement.isLost).toBe(false);
      expect(improvement.slots).toBe(1);
    });
  });

  describe('clearCampaignState', () => {
    it('remet isLost ET isSold à false', () => {
      const improvement = new Improvement(1, makeImprovementType(4, 1), null, false);
      improvement.markLost();
      improvement.markSold();
      improvement.clearCampaignState();
      expect(improvement.isLost).toBe(false);
      expect(improvement.isSold).toBe(false);
    });
  });

  describe('markSold / clearSold', () => {
    it('isSold est false par défaut', () => {
      const improvement = new Improvement(1, makeImprovementType(4, 1), null, false);
      expect(improvement.isSold).toBe(false);
    });

    it('markSold libère l\'emplacement et applique le prix résiduel', () => {
      const improvement = new Improvement(1, makeImprovementType(4, 1), null, false);
      improvement.markSold();
      expect(improvement.isSold).toBe(true);
      expect(improvement.slots).toBe(0);
      expect(improvement.price).toBe(2);
    });

    it('markSold est idempotent', () => {
      const improvement = new Improvement(1, makeImprovementType(4, 1), null, false);
      improvement.markSold();
      improvement.markSold();
      expect(improvement.isSold).toBe(true);
    });

    it('clearSold remet l\'amélioration à l\'état actif (prix plein, emplacement restauré)', () => {
      const improvement = new Improvement(1, makeImprovementType(4, 1), null, false);
      improvement.markSold();
      improvement.clearSold();
      expect(improvement.isSold).toBe(false);
      expect(improvement.slots).toBe(1);
      expect(improvement.price).toBe(4);
    });
  });
});
