import { describe, it, expect } from 'vitest';
import { Weapon } from './weapon';
import { WeaponType } from './value-objects/weapon-type';

function makeWeaponType(prix: number, emplacement: number): WeaponType {
  return WeaponType.from({
    nom: 'Mitrailleuse', nom_interne: 'mitrailleuse', type: 'base',
    prix, emplacement, description: '', regles: '', sponsors_autorises: [],
    necessite_orientation: true,
  });
}

describe('Weapon', () => {
  describe('slots', () => {
    it('retourne le nombre d\'emplacements du catalogue quand l\'arme n\'est pas perdue', () => {
      const weapon = new Weapon(1, makeWeaponType(5, 2), 'avant');
      expect(weapon.slots).toBe(2);
    });

    it('retourne 0 si l\'arme est perdue — emplacement libéré (règle campagne)', () => {
      const weapon = new Weapon(1, makeWeaponType(5, 2), 'avant');
      weapon.markLost();
      expect(weapon.slots).toBe(0);
    });
  });

  describe('price', () => {
    it('est inchangé même si l\'arme est perdue — pas de remboursement', () => {
      const weapon = new Weapon(1, makeWeaponType(5, 2), 'avant');
      weapon.markLost();
      expect(weapon.price).toBe(5);
    });

    it('devient le prix résiduel (ceil(X/2)) une fois vendue', () => {
      const weapon = new Weapon(1, makeWeaponType(5, 2), 'avant');
      weapon.markSold();
      expect(weapon.price).toBe(3); // ceil(5/2) = 3, floor(5/2) = 2 remboursé côté wallet dérivé
    });
  });

  describe('markLost / clearLost', () => {
    it('isLost est false par défaut', () => {
      const weapon = new Weapon(1, makeWeaponType(5, 2), 'avant');
      expect(weapon.isLost).toBe(false);
    });

    it('markLost est idempotent — deux appels successifs ne causent pas d\'erreur', () => {
      const weapon = new Weapon(1, makeWeaponType(5, 2), 'avant');
      weapon.markLost();
      weapon.markLost();
      expect(weapon.isLost).toBe(true);
      expect(weapon.slots).toBe(0);
    });

    it('clearLost remet l\'arme à l\'état actif', () => {
      const weapon = new Weapon(1, makeWeaponType(5, 2), 'avant');
      weapon.markLost();
      weapon.clearLost();
      expect(weapon.isLost).toBe(false);
      expect(weapon.slots).toBe(2);
    });
  });

  describe('markSold / clearSold', () => {
    it('isSold est false par défaut', () => {
      const weapon = new Weapon(1, makeWeaponType(5, 2), 'avant');
      expect(weapon.isSold).toBe(false);
    });

    it('markSold libère l\'emplacement et applique le prix résiduel', () => {
      const weapon = new Weapon(1, makeWeaponType(5, 2), 'avant');
      weapon.markSold();
      expect(weapon.isSold).toBe(true);
      expect(weapon.slots).toBe(0);
      expect(weapon.price).toBe(3);
    });

    it('markSold est idempotent', () => {
      const weapon = new Weapon(1, makeWeaponType(5, 2), 'avant');
      weapon.markSold();
      weapon.markSold();
      expect(weapon.isSold).toBe(true);
    });

    it('clearSold remet l\'arme à l\'état actif (prix plein, emplacement restauré)', () => {
      const weapon = new Weapon(1, makeWeaponType(5, 2), 'avant');
      weapon.markSold();
      weapon.clearSold();
      expect(weapon.isSold).toBe(false);
      expect(weapon.slots).toBe(2);
      expect(weapon.price).toBe(5);
    });
  });

  describe('clearCampaignState', () => {
    it('remet isLost ET isSold à false', () => {
      const weapon = new Weapon(1, makeWeaponType(5, 2), 'avant');
      weapon.markLost();
      weapon.markSold();
      weapon.clearCampaignState();
      expect(weapon.isLost).toBe(false);
      expect(weapon.isSold).toBe(false);
    });
  });
});
