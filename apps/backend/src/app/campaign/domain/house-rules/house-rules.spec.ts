import { describe, it, expect } from 'vitest';
import { HouseRules } from './house-rules';
import { DomainException } from '../../../shared/domain/domain-exception';

describe('HouseRules', () => {
  describe('none()', () => {
    it('ne contient aucune règle active', () => {
      const rules = HouseRules.none();
      expect(rules.isEnabled('resistance_sans_points_championnat')).toBe(false);
      expect(rules.toArray()).toEqual([]);
    });
  });

  describe('fromPersisted()', () => {
    it('hydrate les clés fournies sans validation', () => {
      const rules = HouseRules.fromPersisted(['resistance_sans_points_championnat']);
      expect(rules.isEnabled('resistance_sans_points_championnat')).toBe(true);
    });

    it('tolère une clé orpheline (retirée depuis du catalogue)', () => {
      const rules = HouseRules.fromPersisted(['clef_retiree_du_catalogue']);
      expect(rules.isEnabled('clef_retiree_du_catalogue')).toBe(true);
      expect(rules.toArray()).toEqual(['clef_retiree_du_catalogue']);
    });
  });

  describe('fromUserInput()', () => {
    const validKeys = ['resistance_sans_points_championnat', 'autre_regle'];

    it('accepte un ensemble de clés toutes présentes dans validKeys', () => {
      const rules = HouseRules.fromUserInput(['resistance_sans_points_championnat'], validKeys);
      expect(rules.isEnabled('resistance_sans_points_championnat')).toBe(true);
      expect(rules.isEnabled('autre_regle')).toBe(false);
    });

    it('accepte un tableau vide (aucune règle activée)', () => {
      const rules = HouseRules.fromUserInput([], validKeys);
      expect(rules.toArray()).toEqual([]);
    });

    it('rejette une clé absente de validKeys', () => {
      expect(() => HouseRules.fromUserInput(['clef_inconnue'], validKeys)).toThrow(DomainException);
      expect(() => HouseRules.fromUserInput(['clef_inconnue'], validKeys)).toThrow(/clef_inconnue/);
    });

    it('rejette dès qu\'une seule clé du lot est invalide, même mêlée à des clés valides', () => {
      expect(() =>
        HouseRules.fromUserInput(['resistance_sans_points_championnat', 'clef_inconnue'], validKeys),
      ).toThrow(DomainException);
    });
  });
});
