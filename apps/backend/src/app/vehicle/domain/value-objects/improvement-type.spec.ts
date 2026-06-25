import { ImprovementType } from './improvement-type';
import type { Amelioration } from '../../../catalog/catalog.interfaces';

const ameliorationSimple: Amelioration = {
  nom: 'Bélier',
  nom_interne: 'belier',
  prix: 4,
  emplacement: 1,
  description: '<p>Description</p>',
  regles: '<p>Règles</p>',
  sponsors_autorises: ['Rutherford'],
  comportement: 'belier',
};

const ameliorationSansComportement: Amelioration = {
  nom: 'Arceaux',
  nom_interne: 'arceaux',
  prix: 4,
  emplacement: 1,
  description: '',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

const tourelle: Amelioration = {
  nom: 'Tourelle',
  nom_interne: 'tourelle',
  prix: 'x3',
  emplacement: 0,
  description: '',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

describe('ImprovementType', () => {
  describe('propriétés de base', () => {
    it('expose nomInterne', () => {
      expect(ImprovementType.from(ameliorationSimple).nomInterne).toBe('belier');
    });

    it('expose nom', () => {
      expect(ImprovementType.from(ameliorationSimple).nom).toBe('Bélier');
    });

    it('expose slots', () => {
      expect(ImprovementType.from(ameliorationSimple).slots).toBe(1);
    });

    it('expose description et regles', () => {
      const it_ = ImprovementType.from(ameliorationSimple);
      expect(it_.description).toBe('<p>Description</p>');
      expect(it_.regles).toBe('<p>Règles</p>');
    });

    it('expose comportement quand présent', () => {
      expect(ImprovementType.from(ameliorationSimple).comportement).toBe('belier');
    });

    it('expose comportement undefined quand absent', () => {
      expect(ImprovementType.from(ameliorationSansComportement).comportement).toBeUndefined();
    });
  });

  describe('price', () => {
    it('retourne le prix numérique pour une amélioration classique', () => {
      expect(ImprovementType.from(ameliorationSimple).price).toBe(4);
    });

    it('retourne 0 pour la Tourelle (prix variable "x3")', () => {
      expect(ImprovementType.from(tourelle).price).toBe(0);
    });
  });

  describe('hasVariablePrice', () => {
    it('est false pour une amélioration à prix fixe', () => {
      expect(ImprovementType.from(ameliorationSimple).hasVariablePrice).toBe(false);
    });

    it('est true pour la Tourelle', () => {
      expect(ImprovementType.from(tourelle).hasVariablePrice).toBe(true);
    });
  });

  describe('isTourelle', () => {
    it('est false pour une amélioration ordinaire', () => {
      expect(ImprovementType.from(ameliorationSimple).isTourelle).toBe(false);
    });

    it('est true pour la Tourelle', () => {
      expect(ImprovementType.from(tourelle).isTourelle).toBe(true);
    });
  });

  describe('equals', () => {
    it('retourne true pour deux instances du même nom_interne', () => {
      const a = ImprovementType.from(ameliorationSimple);
      const b = ImprovementType.from({ ...ameliorationSimple });
      expect(a.equals(b)).toBe(true);
    });

    it('retourne false pour deux améliorations différentes', () => {
      const a = ImprovementType.from(ameliorationSimple);
      const b = ImprovementType.from(tourelle);
      expect(a.equals(b)).toBe(false);
    });
  });
});
