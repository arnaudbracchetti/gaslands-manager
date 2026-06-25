import { WeaponType } from './weapon-type';
import type { Arme } from '../../../catalog/catalog.interfaces';

const armeBase: Arme = {
  nom: 'Mitrailleuse',
  nom_interne: 'mitrailleuse',
  type: 'base',
  prix: 4,
  emplacement: 1,
  description: '<p>Description</p>',
  regles: '<p>Règles</p>',
  sponsors_autorises: ['Rutherford'],
};

const armeEquipage: Arme = {
  nom: 'Grenades',
  nom_interne: 'grenades',
  type: 'équipage',
  prix: 2,
  emplacement: 0,
  description: '',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

describe('WeaponType', () => {
  describe('propriétés de base', () => {
    it('expose nomInterne', () => {
      const wt = WeaponType.from(armeBase);
      expect(wt.nomInterne).toBe('mitrailleuse');
    });

    it('expose nom', () => {
      const wt = WeaponType.from(armeBase);
      expect(wt.nom).toBe('Mitrailleuse');
    });

    it('expose price comme number', () => {
      const wt = WeaponType.from(armeBase);
      expect(wt.price).toBe(4);
    });

    it('expose slots', () => {
      const wt = WeaponType.from(armeBase);
      expect(wt.slots).toBe(1);
    });

    it('expose description et regles', () => {
      const wt = WeaponType.from(armeBase);
      expect(wt.description).toBe('<p>Description</p>');
      expect(wt.regles).toBe('<p>Règles</p>');
    });
  });

  describe('type', () => {
    it("expose le type brut de l'arme (base, avancée, équipage, largable)", () => {
      expect(WeaponType.from(armeBase).type).toBe('base');
      const avancee: Arme = { ...armeBase, type: 'avancée' };
      expect(WeaponType.from(avancee).type).toBe('avancée');
    });
  });

  describe('isEquipage', () => {
    it('est false pour une arme de type base', () => {
      expect(WeaponType.from(armeBase).isEquipage).toBe(false);
    });

    it('est true pour une arme de type équipage', () => {
      expect(WeaponType.from(armeEquipage).isEquipage).toBe(true);
    });

    it('est false pour une arme de type avancée', () => {
      const avancee: Arme = { ...armeBase, type: 'avancée' };
      expect(WeaponType.from(avancee).isEquipage).toBe(false);
    });

    it('est false pour une arme de type largable', () => {
      const largable: Arme = { ...armeBase, type: 'largable' };
      expect(WeaponType.from(largable).isEquipage).toBe(false);
    });
  });

  describe('requiresOrientation', () => {
    it('est true pour une arme non-équipage', () => {
      expect(WeaponType.from(armeBase).requiresOrientation).toBe(true);
    });

    it('est false pour une arme équipage (arc 360° natif)', () => {
      expect(WeaponType.from(armeEquipage).requiresOrientation).toBe(false);
    });
  });

  describe('equals', () => {
    it('retourne true pour deux instances du même nom_interne', () => {
      const a = WeaponType.from(armeBase);
      const b = WeaponType.from({ ...armeBase });
      expect(a.equals(b)).toBe(true);
    });

    it('retourne false pour deux armes différentes', () => {
      const a = WeaponType.from(armeBase);
      const b = WeaponType.from(armeEquipage);
      expect(a.equals(b)).toBe(false);
    });
  });
});
