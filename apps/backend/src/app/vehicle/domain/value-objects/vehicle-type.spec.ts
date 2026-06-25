import { VehicleType } from './vehicle-type';
import type { Vehicule } from '../../../catalog/catalog.interfaces';

const buggy: Vehicule = {
  nom: 'Buggy',
  nom_interne: 'buggy',
  poids: 'Léger',
  carrosserie: 6,
  manoeuvrabilite: 4,
  vitesse_max: 6,
  equipage: 2,
  emplacements: 4,
  prix: 8,
  description: '<p>Un buggy</p>',
  regles: '<p>Règles</p>',
  sponsors_autorises: ['Rutherford'],
  ameliorations_defaut: ['arceaux'],
};

const char: Vehicule = {
  nom: "Char d'assaut",
  nom_interne: 'char_assaut',
  poids: 'Lourd',
  carrosserie: 12,
  manoeuvrabilite: 2,
  vitesse_max: 4,
  equipage: 3,
  emplacements: 6,
  prix: 40,
  description: '',
  regles: '',
  sponsors_autorises: ['Rutherford'],
  ameliorations_defaut: ['tourelle'],
};

const moto: Vehicule = {
  nom: 'Moto',
  nom_interne: 'moto',
  poids: 'Léger',
  carrosserie: 4,
  manoeuvrabilite: 5,
  vitesse_max: 8,
  equipage: 1,
  emplacements: 2,
  prix: 5,
  description: '',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

describe('VehicleType', () => {
  describe('propriétés de base', () => {
    it('expose nomInterne', () => {
      expect(VehicleType.from(buggy).nomInterne).toBe('buggy');
    });

    it('expose nom', () => {
      expect(VehicleType.from(buggy).nom).toBe('Buggy');
    });

    it('expose price', () => {
      expect(VehicleType.from(buggy).price).toBe(8);
    });

    it('expose slots (emplacements)', () => {
      expect(VehicleType.from(buggy).slots).toBe(4);
    });

    it('expose les stats complètes', () => {
      const vt = VehicleType.from(buggy);
      expect(vt.carrosserie).toBe(6);
      expect(vt.manoeuvrabilite).toBe(4);
      expect(vt.vitesseMax).toBe(6);
      expect(vt.equipage).toBe(2);
      expect(vt.poids).toBe('Léger');
    });

    it('expose description et regles', () => {
      const vt = VehicleType.from(buggy);
      expect(vt.description).toBe('<p>Un buggy</p>');
      expect(vt.regles).toBe('<p>Règles</p>');
    });
  });

  describe('defaultImprovements', () => {
    it('retourne la liste des nom_interne des améliorations par défaut', () => {
      expect(VehicleType.from(buggy).defaultImprovements).toEqual(['arceaux']);
    });

    it('retourne un tableau vide si aucune amélioration par défaut', () => {
      expect(VehicleType.from(moto).defaultImprovements).toEqual([]);
    });

    it('retourne les améliorations par défaut du char', () => {
      expect(VehicleType.from(char).defaultImprovements).toEqual(['tourelle']);
    });
  });

  describe('toRaw', () => {
    it('retourne le Vehicule brut du catalogue', () => {
      expect(VehicleType.from(buggy).toRaw()).toBe(buggy);
    });
  });

  describe('equals', () => {
    it('retourne true pour deux instances du même nom_interne', () => {
      const a = VehicleType.from(buggy);
      const b = VehicleType.from({ ...buggy });
      expect(a.equals(b)).toBe(true);
    });

    it('retourne false pour deux véhicules différents', () => {
      expect(VehicleType.from(buggy).equals(VehicleType.from(moto))).toBe(false);
    });
  });
});
