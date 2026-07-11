import { describe, it, expect } from 'vitest';
import { Team } from './team';
import { Vehicle } from './vehicle';
import { Weapon } from './weapon';
import { VehicleType } from './value-objects/vehicle-type';
import { WeaponType } from './value-objects/weapon-type';
import { DomainException } from './vehicle';

function makeVehicleType(): VehicleType {
  return VehicleType.from({
    nom: 'Voiture', nom_interne: 'voiture', poids: 'Moyen',
    carrosserie: 6, manoeuvrabilite: 4, vitesse_max: 6, equipage: 2,
    emplacements: 4, prix: 12, description: '', regles: '', sponsors_autorises: [],
  });
}

function makeWeaponType(): WeaponType {
  return WeaponType.from({
    nom: 'Mitrailleuse', nom_interne: 'mitrailleuse', type: 'base',
    prix: 5, emplacement: 1, description: '', regles: '', sponsors_autorises: [],
  });
}

function makeTeam(): Team {
  return new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, []);
}

function makeTeamWithVehicle(): { team: Team; weapon: Weapon } {
  const weaponType = makeWeaponType();
  const weapon = new Weapon(99, weaponType, 'avant');
  const vehicle = new Vehicle(10, 1, makeVehicleType(), [weapon], []);
  const team = new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, [vehicle]);
  return { team, weapon };
}

describe('Team — findWeapon', () => {
  it('retrouve une arme dans les véhicules de l\'équipe', () => {
    const { team, weapon } = makeTeamWithVehicle();
    const found = team.findWeapon(weapon.id);
    expect(found).toBe(weapon);
  });

  it('lève DomainException si l\'arme est introuvable', () => {
    const { team } = makeTeamWithVehicle();
    expect(() => team.findWeapon(999)).toThrow(DomainException);
  });
});

describe('Team — verrouillage campagne', () => {
  function makeLockedTeam(): Team {
    const vehicle = new Vehicle(10, 1, makeVehicleType(), [], []);
    return new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, [vehicle], true);
  }

  it('update() refuse toute modification', () => {
    const team = makeLockedTeam();
    expect(() => team.update({ name: 'Nouveau nom' })).toThrow(DomainException);
  });

  it('addVehicle() refuse toute modification', () => {
    const team = makeLockedTeam();
    expect(() => team.addVehicle(makeVehicleType(), [])).toThrow(DomainException);
  });

  it('addWeaponToVehicle() refuse toute modification', () => {
    const team = makeLockedTeam();
    expect(() => team.addWeaponToVehicle(10, makeWeaponType(), 'avant')).toThrow(DomainException);
  });

  it('assertNotLocked() ne lève rien pour une équipe non verrouillée', () => {
    const team = makeTeam();
    expect(() => team.assertNotLocked()).not.toThrow();
  });

  it("les mutations campagne (addCampaignWeapon) restent autorisées même verrouillée", () => {
    const team = makeLockedTeam();
    expect(() => team.addCampaignWeapon(10, makeWeaponType(), 'avant', -1)).not.toThrow();
  });
});

describe('Team — mutations de base', () => {
  it('update() modifie le nom', () => {
    const team = makeTeam();
    team.update({ name: 'Nouveau nom' });
    expect(team.name).toBe('Nouveau nom');
  });

  it('update() refuse de changer le sponsor si le véhicule est présent', () => {
    const { team } = makeTeamWithVehicle();
    expect(() => team.update({ sponsor: 'Miyazaki' })).toThrow(DomainException);
  });

  it('remainingBudget tient compte du coût des véhicules', () => {
    const { team } = makeTeamWithVehicle();
    // véhicule coûte 12 (chassis) + 5 (arme) = 17
    expect(team.remainingBudget).toBe(50 - 17);
  });
});
