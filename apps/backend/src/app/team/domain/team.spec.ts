import { describe, it, expect } from 'vitest';
import { Team } from './team';
import { Vehicle } from './vehicle';
import { Weapon } from './weapon';
import { Advantage } from './advantage';
import { VehicleType } from './value-objects/vehicle-type';
import { WeaponType } from './value-objects/weapon-type';
import { ImprovementType } from './value-objects/improvement-type';
import { AdvantageType } from './value-objects/advantage-type';
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
    necessite_orientation: true,
  });
}

function makeTeam(): Team {
  return new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, []);
}

function makeAdvantageType(): AdvantageType {
  return AdvantageType.from({
    nom: 'Tireur d\'Élite', nom_interne: 'tireur_elite', categorie: 'Militaire',
    prix: 2, description: '', regles: '',
  });
}

function makeImprovementType(): ImprovementType {
  return ImprovementType.from({
    nom: 'Blindage', nom_interne: 'blindage', prix: 4, emplacement: 1,
    description: '', regles: '', sponsors_autorises: [], necessite_orientation: false,
  });
}

function makeTeamWithVehicle(): { team: Team; weapon: Weapon } {
  const weaponType = makeWeaponType();
  const weapon = new Weapon(99, weaponType, 'avant');
  const vehicle = new Vehicle(10, 1, makeVehicleType(), [weapon], []);
  const team = new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, [vehicle]);
  return { team, weapon };
}

function makeTeamWithAdvantage(): { team: Team; advantage: Advantage } {
  const advantage = new Advantage(77, makeAdvantageType());
  const vehicle = new Vehicle(10, 1, makeVehicleType(), [], [], [advantage]);
  const team = new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, [vehicle]);
  return { team, advantage };
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

describe('Team — findAdvantage', () => {
  it('retrouve un avantage dans les véhicules de l\'équipe', () => {
    const { team, advantage } = makeTeamWithAdvantage();
    expect(team.findAdvantage(advantage.id)).toBe(advantage);
  });

  it('lève DomainException si l\'avantage est introuvable', () => {
    const { team } = makeTeamWithAdvantage();
    expect(() => team.findAdvantage(999)).toThrow(DomainException);
  });
});

describe('Team — mutations Advantage (déléguées au Vehicle)', () => {
  it('addAdvantageToVehicle ajoute l\'avantage au véhicule ciblé', () => {
    const { team } = makeTeamWithVehicle();
    team.addAdvantageToVehicle(10, makeAdvantageType());
    expect(team.findVehicle(10).advantages).toHaveLength(1);
  });

  it('removeAdvantageFromVehicle retire l\'avantage ciblé', () => {
    const { team, advantage } = makeTeamWithAdvantage();
    team.removeAdvantageFromVehicle(10, advantage.id);
    expect(team.findVehicle(10).advantages).toHaveLength(0);
  });

  it('markAdvantageSold/clearAdvantageSold délèguent au véhicule (isSold ne réduit jamais le prix)', () => {
    const { team, advantage } = makeTeamWithAdvantage();
    team.markAdvantageSold(10, advantage.id);
    expect(advantage.isSold).toBe(true);
    expect(advantage.price).toBe(2); // jamais réduit — perte totale
    team.clearAdvantageSold(10, advantage.id);
    expect(advantage.isSold).toBe(false);
  });

  it('addCampaignAdvantage ajoute un avantage transient avec un id explicite (D-S11)', () => {
    const { team } = makeTeamWithVehicle();
    const advantage = team.addCampaignAdvantage(10, makeAdvantageType(), -5);
    expect(advantage.id).toBe(-5);
    expect(team.findVehicle(10).advantages).toHaveLength(1);
  });

  it('removeCampaignAdvantage retire un avantage transient (annulation d\'achat en session courante)', () => {
    const { team } = makeTeamWithVehicle();
    team.addCampaignAdvantage(10, makeAdvantageType(), -5);
    team.removeCampaignAdvantage(10, -5);
    expect(team.findVehicle(10).advantages).toHaveLength(0);
  });
});

describe('Team.resetCampaignState — remet aussi les avantages à zéro', () => {
  it('clearCampaignState() de chaque avantage est appelé (isSold remis à false)', () => {
    const { team, advantage } = makeTeamWithAdvantage();
    advantage.markSold();
    team.resetCampaignState();
    expect(advantage.isSold).toBe(false);
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

  it('addAdvantageToVehicle() refuse toute modification', () => {
    const team = makeLockedTeam();
    expect(() => team.addAdvantageToVehicle(10, makeAdvantageType())).toThrow(DomainException);
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

// Régression : la règle "équipe verrouillée bloque tout verdict de disponibilité" était
// réimplémentée à l'identique dans 3 use cases (GetAvailable{Weapons,Improvements,
// Advantages}UseCase) au lieu de vivre dans le domaine — cf. [[feedback_business_rules_in_domain_only]].
describe('Team — canAddXToVehicle (verdict de disponibilité, sans mutation)', () => {
  function makeLockedTeamWithVehicle(): Team {
    const vehicle = new Vehicle(10, 1, makeVehicleType(), [], []);
    return new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, [vehicle], true);
  }

  it('canAddWeaponToVehicle renvoie fail("Équipe verrouillée...") sans consulter l\'agrégat', () => {
    const result = makeLockedTeamWithVehicle().canAddWeaponToVehicle(10, makeWeaponType(), 'avant');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('verrouillée');
  });

  it('canAddImprovementToVehicle renvoie fail("Équipe verrouillée...")', () => {
    const result = makeLockedTeamWithVehicle().canAddImprovementToVehicle(10, makeImprovementType());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('verrouillée');
  });

  it('canAddAdvantageToVehicle renvoie fail("Équipe verrouillée...")', () => {
    const result = makeLockedTeamWithVehicle().canAddAdvantageToVehicle(10, makeAdvantageType());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('verrouillée');
  });

  it('canAddWeaponToVehicle délègue à Vehicle.canAddWeapon quand l\'équipe n\'est pas verrouillée', () => {
    const vehicle = new Vehicle(10, 1, makeVehicleType(), [], []);
    const team = new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, [vehicle]);
    expect(team.canAddWeaponToVehicle(10, makeWeaponType(), 'avant').ok).toBe(true);
  });

  it('canAddImprovementToVehicle délègue à Vehicle.canAddImprovementInAnyOrientation', () => {
    const vehicle = new Vehicle(10, 1, makeVehicleType(), [], []);
    const team = new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, [vehicle]);
    expect(team.canAddImprovementToVehicle(10, makeImprovementType()).ok).toBe(true);
  });

  it('canAddAdvantageToVehicle délègue à Vehicle.canAddAdvantage', () => {
    const vehicle = new Vehicle(10, 1, makeVehicleType(), [], []);
    const team = new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, [vehicle]);
    expect(team.canAddAdvantageToVehicle(10, makeAdvantageType()).ok).toBe(true);
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
