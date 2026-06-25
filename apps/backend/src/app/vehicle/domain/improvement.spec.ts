import { Improvement } from './improvement';
import { ImprovementType } from './value-objects/improvement-type';
import { WeaponType } from './value-objects/weapon-type';
import type { Amelioration, Arme } from '../../catalog/catalog.interfaces';

const amelBelier: Amelioration = {
  nom: 'Bélier',
  nom_interne: 'belier',
  prix: 4,
  emplacement: 1,
  description: '',
  regles: '',
  sponsors_autorises: ['Rutherford'],
  comportement: 'belier',
};

const amelArceaux: Amelioration = {
  nom: 'Arceaux',
  nom_interne: 'arceaux',
  prix: 4,
  emplacement: 1,
  description: '',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

const amelTourelle: Amelioration = {
  nom: 'Tourelle',
  nom_interne: 'tourelle',
  prix: 'x3',
  emplacement: 0,
  description: '',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

const armeMitrailleuse: Arme = {
  nom: 'Mitrailleuse',
  nom_interne: 'mitrailleuse',
  type: 'base',
  prix: 4,
  emplacement: 1,
  description: '',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

describe('Improvement', () => {
  describe('amélioration classique achetée', () => {
    it('expose son id', () => {
      const imp = new Improvement(1, ImprovementType.from(amelBelier), 'avant', false);
      expect(imp.id).toBe(1);
    });

    it('expose son type', () => {
      const imp = new Improvement(1, ImprovementType.from(amelBelier), 'avant', false);
      expect(imp.type.nomInterne).toBe('belier');
    });

    it('expose son orientation', () => {
      const imp = new Improvement(1, ImprovementType.from(amelBelier), 'avant', false);
      expect(imp.orientation).toBe('avant');
    });

    it('expose estDefaut à false', () => {
      const imp = new Improvement(1, ImprovementType.from(amelBelier), null, false);
      expect(imp.estDefaut).toBe(false);
    });

    it('retourne le prix catalogue', () => {
      const imp = new Improvement(1, ImprovementType.from(amelBelier), null, false);
      expect(imp.price).toBe(4);
    });

    it('retourne les slots catalogue', () => {
      const imp = new Improvement(1, ImprovementType.from(amelBelier), null, false);
      expect(imp.slots).toBe(1);
    });
  });

  describe('amélioration par défaut (estDefaut)', () => {
    it('expose estDefaut à true', () => {
      const imp = new Improvement(2, ImprovementType.from(amelArceaux), null, true);
      expect(imp.estDefaut).toBe(true);
    });

    it('retourne price 0 (coût zéro, intégrée au profil)', () => {
      const imp = new Improvement(2, ImprovementType.from(amelArceaux), null, true);
      expect(imp.price).toBe(0);
    });

    it('retourne slots 0 (ne consomme pas le pool achetable)', () => {
      const imp = new Improvement(2, ImprovementType.from(amelArceaux), null, true);
      expect(imp.slots).toBe(0);
    });
  });

  describe('Tourelle orpheline (sans arme assignée)', () => {
    it('a weaponAssignee null par défaut', () => {
      const imp = new Improvement(3, ImprovementType.from(amelTourelle), null, false);
      expect(imp.weaponAssignee).toBeNull();
    });

    it("retourne price 0 tant qu'aucune arme n'est assignée", () => {
      const imp = new Improvement(3, ImprovementType.from(amelTourelle), null, false);
      expect(imp.price).toBe(0);
    });

    it("retourne slots 0 (la Tourelle elle-même ne consomme pas d'emplacement)", () => {
      const imp = new Improvement(3, ImprovementType.from(amelTourelle), null, false);
      expect(imp.slots).toBe(0);
    });
  });

  describe('Tourelle assignée', () => {
    it('expose le WeaponType assigné', () => {
      const imp = new Improvement(3, ImprovementType.from(amelTourelle), null, false);
      imp.assignWeapon(WeaponType.from(armeMitrailleuse));
      expect(imp.weaponAssignee?.nomInterne).toBe('mitrailleuse');
    });

    it("retourne price = 3 x prix de l'arme assignée", () => {
      const imp = new Improvement(3, ImprovementType.from(amelTourelle), null, false);
      imp.assignWeapon(WeaponType.from(armeMitrailleuse));
      expect(imp.price).toBe(12); // 3 × 4
    });

    it("peut désassigner l'arme (retour à orpheline)", () => {
      const imp = new Improvement(3, ImprovementType.from(amelTourelle), null, false);
      imp.assignWeapon(WeaponType.from(armeMitrailleuse));
      imp.unassignWeapon();
      expect(imp.weaponAssignee).toBeNull();
      expect(imp.price).toBe(0);
    });
  });
});
