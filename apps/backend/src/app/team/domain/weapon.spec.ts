import { describe, it, expect } from 'vitest';
import { Weapon } from './weapon';
import { WeaponType } from './value-objects/weapon-type';

function makeWeaponType(prix: number, emplacement: number): WeaponType {
  return WeaponType.from({
    nom: 'Mitrailleuse', nom_interne: 'mitrailleuse', type: 'base',
    prix, emplacement, description: '', regles: '', sponsors_autorises: [],
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
});
