import { describe, it, expect } from 'vitest';
import { Vehicle } from './vehicle';
import { VehicleType } from './value-objects/vehicle-type';
import { WeaponType } from './value-objects/weapon-type';
import { ImprovementType } from './value-objects/improvement-type';
import { SequellaType } from './value-objects/sequella-type';
import { DomainException } from './vehicle';

function makeVehicleType(emplacements = 4, prix = 12): VehicleType {
  return VehicleType.from({
    nom: 'Voiture', nom_interne: 'voiture', poids: 'Moyen',
    carrosserie: 6, manoeuvrabilite: 4, vitesse_max: 6, equipage: 2,
    emplacements, prix, description: '', regles: '', sponsors_autorises: [],
  });
}

function makeWeaponType(prix = 5, emplacement = 1): WeaponType {
  return WeaponType.from({
    nom: 'Mitrailleuse', nom_interne: 'mitrailleuse', type: 'base',
    prix, emplacement, description: '', regles: '', sponsors_autorises: [],
  });
}

function makeImprovementType(prix = 4, emplacement = 1): ImprovementType {
  return ImprovementType.from({
    nom: 'Bélier', nom_interne: 'belier', prix, emplacement,
    description: '', regles: '', sponsors_autorises: [],
  });
}

function makeVehicle(emplacements = 4, prix = 12): Vehicle {
  return new Vehicle(1, 10, makeVehicleType(emplacements, prix), [], []);
}

describe('Vehicle — champs transients de campagne', () => {
  describe('markLost / clearLost', () => {
    it('isLost est false par défaut', () => {
      expect(makeVehicle().isLost).toBe(false);
    });

    it('markLost est idempotent', () => {
      const v = makeVehicle();
      v.markLost();
      v.markLost();
      expect(v.isLost).toBe(true);
    });

    it('clearLost remet le véhicule à l\'état actif', () => {
      const v = makeVehicle();
      v.markLost();
      v.clearLost();
      expect(v.isLost).toBe(false);
    });
  });

  describe('canAddWeapon — garde _isLost', () => {
    it('retourne fail si le véhicule est perdu', () => {
      const v = makeVehicle();
      v.markLost();
      const result = v.canAddWeapon(makeWeaponType(), 'avant', 100);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toContain('hors combat');
    });

    it('autorise l\'ajout si le véhicule n\'est pas perdu', () => {
      const v = makeVehicle();
      const result = v.canAddWeapon(makeWeaponType(), 'avant', 100);
      expect(result.ok).toBe(true);
    });
  });

  describe('canAddImprovement — garde _isLost', () => {
    it('retourne fail si le véhicule est perdu', () => {
      const v = makeVehicle();
      v.markLost();
      const result = v.canAddImprovement(makeImprovementType(), null, 100);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toContain('hors combat');
    });

    it('autorise l\'ajout si le véhicule n\'est pas perdu', () => {
      const v = makeVehicle();
      const result = v.canAddImprovement(makeImprovementType(), null, 100);
      expect(result.ok).toBe(true);
    });
  });

  describe('addChocs', () => {
    it('chocs est 0 par défaut', () => {
      expect(makeVehicle().chocs).toBe(0);
    });

    it('incrémente les chocs', () => {
      const v = makeVehicle();
      v.addChocs(3);
      expect(v.chocs).toBe(3);
    });

    it('décrémente les chocs avec une valeur négative', () => {
      const v = makeVehicle();
      v.addChocs(5);
      v.addChocs(-2);
      expect(v.chocs).toBe(3);
    });

    it('lève DomainException si le résultat serait négatif', () => {
      const v = makeVehicle();
      v.addChocs(2);
      expect(() => v.addChocs(-3)).toThrow(DomainException);
    });
  });

  describe('addSequella / removeLastSequella', () => {
    const moteur = SequellaType.from({ nom: 'Moteur endommagé', nom_interne: 'moteur_endommage', description: '', chocs_cost: 2 });
    const direction = SequellaType.from({ nom: 'Direction endommagée', nom_interne: 'direction_endommage', description: '', chocs_cost: 2 });

    it('sequellas est vide par défaut', () => {
      expect(makeVehicle().sequellas).toHaveLength(0);
    });

    it('addSequella empile les SequellaType dans l\'ordre d\'application', () => {
      const v = makeVehicle();
      v.addSequella(moteur);
      v.addSequella(direction);
      expect(v.sequellas).toHaveLength(2);
      expect(v.sequellas[0].nomInterne).toBe('moteur_endommage');
      expect(v.sequellas[1].nomInterne).toBe('direction_endommage');
    });

    it('removeLastSequella annule la dernière séquelle (undo)', () => {
      const v = makeVehicle();
      v.addSequella(moteur);
      v.addSequella(direction);
      v.removeLastSequella();
      expect(v.sequellas).toHaveLength(1);
      expect(v.sequellas[0].nomInterne).toBe('moteur_endommage');
    });
  });
});
