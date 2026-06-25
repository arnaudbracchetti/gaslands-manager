import { Vehicle, DomainException } from './vehicle';
import { Weapon } from './weapon';
import { Improvement } from './improvement';
import { VehicleType } from './value-objects/vehicle-type';
import { WeaponType } from './value-objects/weapon-type';
import { ImprovementType } from './value-objects/improvement-type';
import type { Vehicule, Arme, Amelioration } from '../../catalog/catalog.interfaces';

// ── Fixtures catalogue ────────────────────────────────────────────────────────

const rawBuggy: Vehicule = {
  nom: 'Buggy',
  nom_interne: 'buggy',
  poids: 'Léger',
  carrosserie: 6,
  manoeuvrabilite: 4,
  vitesse_max: 6,
  equipage: 2,
  emplacements: 4,
  prix: 8,
  description: '',
  regles: '',
  sponsors_autorises: ['Rutherford'],
  ameliorations_defaut: ['arceaux'],
};

const rawMitrailleuse: Arme = {
  nom: 'Mitrailleuse',
  nom_interne: 'mitrailleuse',
  type: 'base',
  prix: 4,
  emplacement: 1,
  description: '',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

const rawGrenades: Arme = {
  nom: 'Grenades',
  nom_interne: 'grenades',
  type: 'équipage',
  prix: 2,
  emplacement: 0,
  description: '',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

const rawBelier: Amelioration = {
  nom: 'Bélier',
  nom_interne: 'belier',
  prix: 4,
  emplacement: 1,
  description: '',
  regles: '',
  sponsors_autorises: ['Rutherford'],
  comportement: 'belier',
};

const rawArceaux: Amelioration = {
  nom: 'Arceaux',
  nom_interne: 'arceaux',
  prix: 4,
  emplacement: 1,
  description: '',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

const rawTourelle: Amelioration = {
  nom: 'Tourelle',
  nom_interne: 'tourelle',
  prix: 'x3',
  emplacement: 0,
  description: '',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeVehicle(
  weapons: Weapon[] = [],
  improvements: Improvement[] = [],
): Vehicle {
  return new Vehicle(1, 10, 'Rutherford', VehicleType.from(rawBuggy), weapons, improvements);
}

function makeWeapon(raw: Arme, orientation: 'avant' | 'arrière' | 'gauche' | 'droite' | null = 'avant'): Weapon {
  return new Weapon(Math.random(), WeaponType.from(raw), orientation);
}

function makeImprovement(raw: Amelioration, estDefaut = false): Improvement {
  return new Improvement(Math.random(), ImprovementType.from(raw), null, estDefaut);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Vehicle', () => {
  describe('lecture de base', () => {
    it('expose son id', () => {
      expect(makeVehicle().id).toBe(1);
    });

    it('expose son type', () => {
      expect(makeVehicle().type.nomInterne).toBe('buggy');
    });

    it('expose son teamId', () => {
      expect(makeVehicle().teamId).toBe(10);
    });

    it('expose son sponsorNom', () => {
      expect(makeVehicle().sponsorNom).toBe('Rutherford');
    });

    it('expose ses armes montées', () => {
      const w = makeWeapon(rawMitrailleuse);
      expect(makeVehicle([w]).weapons).toHaveLength(1);
    });

    it('expose ses améliorations montées', () => {
      const imp = makeImprovement(rawBelier);
      expect(makeVehicle([], [imp]).improvements).toHaveLength(1);
    });
  });

  describe('cost', () => {
    it('retourne le prix du véhicule nu (sans équipement)', () => {
      expect(makeVehicle().cost).toBe(8);
    });

    it('additionne le coût des armes', () => {
      const v = makeVehicle([makeWeapon(rawMitrailleuse)]);
      expect(v.cost).toBe(8 + 4); // buggy + mitrailleuse
    });

    it('additionne le coût des améliorations achetées', () => {
      const v = makeVehicle([], [makeImprovement(rawBelier)]);
      expect(v.cost).toBe(8 + 4); // buggy + belier
    });

    it("n'inclut pas le coût des améliorations par défaut (estDefaut)", () => {
      const arceauxDefaut = makeImprovement(rawArceaux, true);
      const v = makeVehicle([], [arceauxDefaut]);
      expect(v.cost).toBe(8); // arceaux intégrés = 0
    });
  });

  describe('usedSlots', () => {
    it('est 0 pour un véhicule nu', () => {
      expect(makeVehicle().usedSlots).toBe(0);
    });

    it('compte les emplacements des armes', () => {
      const v = makeVehicle([makeWeapon(rawMitrailleuse)]);
      expect(v.usedSlots).toBe(1);
    });

    it('compte les emplacements des améliorations achetées', () => {
      const v = makeVehicle([], [makeImprovement(rawBelier)]);
      expect(v.usedSlots).toBe(1);
    });

    it("n'inclut pas les emplacements des améliorations par défaut", () => {
      const arceauxDefaut = makeImprovement(rawArceaux, true);
      const v = makeVehicle([], [arceauxDefaut]);
      expect(v.usedSlots).toBe(0);
    });

    it('additionne armes et améliorations', () => {
      const v = makeVehicle(
        [makeWeapon(rawMitrailleuse)],   // 1 slot
        [makeImprovement(rawBelier)],     // 1 slot
      );
      expect(v.usedSlots).toBe(2);
    });

    it("ne compte pas les armes équipage dans les emplacements (emplacement = 0)", () => {
      const v = makeVehicle([makeWeapon(rawGrenades, null)]);
      expect(v.usedSlots).toBe(0);
    });
  });

  describe('addWeapon', () => {
    it('ajoute une arme au véhicule', () => {
      const v = makeVehicle();
      v.addWeapon(WeaponType.from(rawMitrailleuse), 'avant', 50);
      expect(v.weapons).toHaveLength(1);
    });

    it('lève une DomainException si le budget est insuffisant', () => {
      const v = makeVehicle();
      expect(() => v.addWeapon(WeaponType.from(rawMitrailleuse), 'avant', 1)).toThrow();
    });

    it('lève une DomainException si plus assez de slots', () => {
      // Buggy a 4 slots — on en remplit 4 avec des mitrailleuses (1 slot chacune)
      const weapons = [
        makeWeapon(rawMitrailleuse),
        makeWeapon(rawMitrailleuse),
        makeWeapon(rawMitrailleuse),
        makeWeapon(rawMitrailleuse),
      ];
      const v = makeVehicle(weapons);
      expect(() => v.addWeapon(WeaponType.from(rawMitrailleuse), 'avant', 50)).toThrow();
    });

    it("lève une DomainException si l'orientation est manquante pour une arme non-équipage", () => {
      const v = makeVehicle();
      expect(() => v.addWeapon(WeaponType.from(rawMitrailleuse), null, 50)).toThrow();
    });

    it("n'exige pas d'orientation pour une arme équipage", () => {
      const v = makeVehicle();
      expect(() => v.addWeapon(WeaponType.from(rawGrenades), null, 50)).not.toThrow();
    });
  });

  describe('removeWeapon', () => {
    it('retire une arme par son id', () => {
      const w = new Weapon(42, WeaponType.from(rawMitrailleuse), 'avant');
      const v = makeVehicle([w]);
      v.removeWeapon(42);
      expect(v.weapons).toHaveLength(0);
    });

    it("lève une DomainException si l'arme est inconnue", () => {
      const v = makeVehicle();
      expect(() => v.removeWeapon(999)).toThrow();
    });
  });

  describe('addImprovement', () => {
    it('ajoute une amélioration au véhicule', () => {
      const v = makeVehicle();
      v.addImprovement(ImprovementType.from(rawBelier), 'avant', 50);
      expect(v.improvements).toHaveLength(1);
    });

    it('lève une DomainException si le budget est insuffisant', () => {
      const v = makeVehicle();
      expect(() => v.addImprovement(ImprovementType.from(rawBelier), null, 1)).toThrow();
    });

    it('lève une DomainException si plus assez de slots', () => {
      // Buggy a 4 slots — on en remplit 4 avec des armes (1 slot chacune)
      const weapons = [
        makeWeapon(rawMitrailleuse),
        makeWeapon(rawMitrailleuse),
        makeWeapon(rawMitrailleuse),
        makeWeapon(rawMitrailleuse),
      ];
      const v = makeVehicle(weapons);
      expect(() => v.addImprovement(ImprovementType.from(rawBelier), null, 50)).toThrow();
    });
  });

  describe('removeImprovement', () => {
    it('retire une amélioration achetée par son id', () => {
      const imp = new Improvement(99, ImprovementType.from(rawBelier), null, false);
      const v = makeVehicle([], [imp]);
      v.removeImprovement(99);
      expect(v.improvements).toHaveLength(0);
    });

    it('lève une DomainException pour une amélioration par défaut (non supprimable)', () => {
      const imp = new Improvement(88, ImprovementType.from(rawArceaux), null, true);
      const v = makeVehicle([], [imp]);
      expect(() => v.removeImprovement(88)).toThrow();
    });

    it("lève une DomainException si l'amélioration est inconnue", () => {
      const v = makeVehicle();
      expect(() => v.removeImprovement(999)).toThrow();
    });
  });

  describe('canAddWeapon', () => {
    it('retourne ok si tout est valide', () => {
      const v = makeVehicle();
      const result = v.canAddWeapon(WeaponType.from(rawMitrailleuse), 'avant', 50);
      expect(result.ok).toBe(true);
    });

    it('retourne un échec si budget insuffisant', () => {
      const v = makeVehicle();
      const result = v.canAddWeapon(WeaponType.from(rawMitrailleuse), 'avant', 1);
      expect(result.ok).toBe(false);
    });

    it('retourne un échec si slots insuffisants', () => {
      const weapons = [
        makeWeapon(rawMitrailleuse),
        makeWeapon(rawMitrailleuse),
        makeWeapon(rawMitrailleuse),
        makeWeapon(rawMitrailleuse),
      ];
      const v = makeVehicle(weapons);
      const result = v.canAddWeapon(WeaponType.from(rawMitrailleuse), 'avant', 50);
      expect(result.ok).toBe(false);
    });

    it('retourne un échec si orientation manquante pour arme non-équipage', () => {
      const v = makeVehicle();
      const result = v.canAddWeapon(WeaponType.from(rawMitrailleuse), null, 50);
      expect(result.ok).toBe(false);
    });

    it('retourne ok pour arme équipage sans orientation', () => {
      const v = makeVehicle();
      const result = v.canAddWeapon(WeaponType.from(rawGrenades), null, 50);
      expect(result.ok).toBe(true);
    });
  });

  describe('canAddImprovement', () => {
    it('retourne ok si tout est valide', () => {
      const v = makeVehicle();
      const result = v.canAddImprovement(ImprovementType.from(rawBelier), 'avant', 50);
      expect(result.ok).toBe(true);
    });

    it('retourne un échec si budget insuffisant', () => {
      const v = makeVehicle();
      const result = v.canAddImprovement(ImprovementType.from(rawBelier), null, 1);
      expect(result.ok).toBe(false);
    });

    it('retourne ok pour la Tourelle même si budget faible (prix variable)', () => {
      const v = makeVehicle();
      const result = v.canAddImprovement(ImprovementType.from(rawTourelle), null, 0);
      expect(result.ok).toBe(true);
    });
  });

  describe('assignWeaponToTourelle', () => {
    // Mitrailleuse à 4 → coût Tourelle = 4 × 3 = 12.
    function makeVehicleWithTourelle(): { v: Vehicle; tourelle: Improvement } {
      const tourelle = makeImprovement(rawTourelle);
      return { v: makeVehicle([], [tourelle]), tourelle };
    }

    it('assigne l\'arme si le coût ×3 tient dans le budget', () => {
      const { v, tourelle } = makeVehicleWithTourelle();
      v.assignWeaponToTourelle(tourelle.id, WeaponType.from(rawMitrailleuse), 50);
      expect(tourelle.weaponAssignee?.nomInterne).toBe('mitrailleuse');
      expect(tourelle.price).toBe(12);
    });

    it('lève DomainException si le coût ×3 dépasse le budget', () => {
      const { v, tourelle } = makeVehicleWithTourelle();
      expect(() =>
        v.assignWeaponToTourelle(tourelle.id, WeaponType.from(rawMitrailleuse), 10),
      ).toThrow(DomainException);
      // Rollback : la Tourelle reste orpheline.
      expect(tourelle.weaponAssignee).toBeNull();
    });

    it('lève DomainException si l\'amélioration n\'est pas une Tourelle', () => {
      const belier = makeImprovement(rawBelier);
      const v = makeVehicle([], [belier]);
      expect(() =>
        v.assignWeaponToTourelle(belier.id, WeaponType.from(rawMitrailleuse), 50),
      ).toThrow(DomainException);
    });

    it('autorise la ré-assignation tant que le delta tient dans le budget', () => {
      // Tourelle déjà montée avec la mitrailleuse (coût actuel 12). Budget restant
      // simulé = 0 ; on « rend » les 12 → 12 dispo. Ré-assigner une arme à 4 (×3 = 12) passe.
      const { v, tourelle } = makeVehicleWithTourelle();
      tourelle.assignWeapon(WeaponType.from(rawMitrailleuse));
      v.assignWeaponToTourelle(tourelle.id, WeaponType.from(rawMitrailleuse), 0);
      expect(tourelle.weaponAssignee?.nomInterne).toBe('mitrailleuse');
    });

    it('refuse la ré-assignation vers une arme plus chère que le delta', () => {
      // Tourelle montée avec une arme bon marché (prix 1 → coût 3). Budget restant 0,
      // on rend 3 → 3 dispo. Ré-assigner la mitrailleuse (×3 = 12 > 3) échoue, rollback.
      const armeBonMarche: Arme = { ...rawMitrailleuse, nom_interne: 'pistolet', prix: 1 };
      const { v, tourelle } = makeVehicleWithTourelle();
      tourelle.assignWeapon(WeaponType.from(armeBonMarche));
      expect(() =>
        v.assignWeaponToTourelle(tourelle.id, WeaponType.from(rawMitrailleuse), 0),
      ).toThrow(DomainException);
      // Rollback : l'arme bon marché précédente est restaurée.
      expect(tourelle.weaponAssignee?.nomInterne).toBe('pistolet');
    });
  });
});
