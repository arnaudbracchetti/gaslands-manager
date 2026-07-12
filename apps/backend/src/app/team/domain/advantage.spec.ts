import { describe, it, expect } from 'vitest';
import { Advantage } from './advantage';
import { AdvantageType } from './value-objects/advantage-type';

function makeAdvantageType(prix: number): AdvantageType {
  return AdvantageType.from({
    nom: 'Expertise', nom_interne: 'expertise', categorie: 'Précision',
    prix, description: '', regles: '', comportement: 'expertise',
  });
}

describe('Advantage', () => {
  describe('slots', () => {
    it('est toujours 0 — un avantage n\'occupe jamais d\'emplacement', () => {
      const advantage = new Advantage(1, makeAdvantageType(3));
      expect(advantage.slots).toBe(0);
    });

    it('reste 0 même une fois vendu', () => {
      const advantage = new Advantage(1, makeAdvantageType(3));
      advantage.markSold();
      expect(advantage.slots).toBe(0);
    });
  });

  describe('price — perte totale à la revente', () => {
    it('vaut le prix catalogue par défaut', () => {
      const advantage = new Advantage(1, makeAdvantageType(3));
      expect(advantage.price).toBe(3);
    });

    it('reste INCHANGÉ une fois vendu — contrairement à Weapon/Improvement (ceil(prix/2))', () => {
      const advantage = new Advantage(1, makeAdvantageType(3));
      advantage.markSold();
      expect(advantage.price).toBe(3);
    });
  });

  describe('resaleRefund — perte totale', () => {
    it('vaut toujours 0 avant la vente — aucun remboursement', () => {
      const advantage = new Advantage(1, makeAdvantageType(3));
      expect(advantage.resaleRefund).toBe(0);
    });

    it('lève une DomainException si appelé après markSold — précondition explicite', () => {
      const advantage = new Advantage(1, makeAdvantageType(3));
      advantage.markSold();
      expect(() => advantage.resaleRefund).toThrow('Cet avantage est déjà vendu');
    });
  });

  describe('markSold / clearSold', () => {
    it('isSold est false par défaut', () => {
      const advantage = new Advantage(1, makeAdvantageType(3));
      expect(advantage.isSold).toBe(false);
    });

    it('markSold est idempotent', () => {
      const advantage = new Advantage(1, makeAdvantageType(3));
      advantage.markSold();
      advantage.markSold();
      expect(advantage.isSold).toBe(true);
    });

    it('clearSold remet l\'avantage à l\'état actif', () => {
      const advantage = new Advantage(1, makeAdvantageType(3));
      advantage.markSold();
      advantage.clearSold();
      expect(advantage.isSold).toBe(false);
    });
  });

  describe('clearCampaignState', () => {
    it('remet isSold à false', () => {
      const advantage = new Advantage(1, makeAdvantageType(3));
      advantage.markSold();
      advantage.clearCampaignState();
      expect(advantage.isSold).toBe(false);
    });
  });
});
