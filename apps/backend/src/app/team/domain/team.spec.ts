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

/** Véhicule catalogue avec équipement intégré — mirroir du Buggy/Char d'assaut réels. */
function makeVehicleTypeWithDefaults(): VehicleType {
  return VehicleType.from({
    nom: 'Buggy', nom_interne: 'buggy', poids: 'Léger',
    carrosserie: 4, manoeuvrabilite: 5, vitesse_max: 7, equipage: 1,
    emplacements: 2, prix: 6, description: '', regles: '', sponsors_autorises: [],
    ameliorations_defaut: ['arceaux'],
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

  it('renameVehicle() refuse toute modification', () => {
    const team = makeLockedTeam();
    expect(() => team.renameVehicle(10, 'La Teigne')).toThrow(DomainException);
  });

  it('assertNotLocked() ne lève rien pour une équipe non verrouillée', () => {
    const team = makeTeam();
    expect(() => team.assertNotLocked()).not.toThrow();
  });

  it("les mutations campagne (addCampaignWeapon) restent autorisées même verrouillée", () => {
    const team = makeLockedTeam();
    expect(() => team.addCampaignWeapon(10, makeWeaponType(), 'avant', -1)).not.toThrow();
  });

  it("renameCampaignVehicle() fonctionne même équipe verrouillée (Atelier)", () => {
    const team = makeLockedTeam();
    expect(() => team.renameCampaignVehicle(10, 'La Teigne')).not.toThrow();
    expect(team.findVehicle(10).nom).toBe('La Teigne (Voiture)');
  });
});

describe('Team.renameVehicle / renameCampaignVehicle', () => {
  it('renameVehicle() renomme le véhicule quand l\'équipe est déverrouillée', () => {
    const vehicle = new Vehicle(10, 1, makeVehicleType(), [], []);
    const team = new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, [vehicle]);
    team.renameVehicle(10, 'La Teigne');
    expect(team.findVehicle(10).nom).toBe('La Teigne (Voiture)');
  });

  it('renameCampaignVehicle() fonctionne sur un véhicule transient (id négatif, D-S11)', () => {
    const team = makeTeam();
    team.addCampaignVehicle(makeVehicleType(), -5);
    team.renameCampaignVehicle(-5, 'La Teigne');
    expect(team.findVehicle(-5).nom).toBe('La Teigne (Voiture)');
  });
});

describe('Team.addCampaignVehicle — équipement par défaut (achat en atelier)', () => {
  it('sans défauts catalogue, le véhicule reste nu (comportement inchangé)', () => {
    const team = makeTeam();
    const vehicle = team.addCampaignVehicle(makeVehicleType(), -5);
    expect(vehicle.weapons).toHaveLength(0);
    expect(vehicle.improvements).toHaveLength(0);
  });

  it("reproduit l'amélioration par défaut du véhicule (estDefaut, prix 0, non retirable)", () => {
    const team = makeTeam();
    const arceaux = makeImprovementType();
    const vehicle = team.addCampaignVehicle(makeVehicleTypeWithDefaults(), -5, [arceaux]);
    expect(vehicle.improvements).toHaveLength(1);
    expect(vehicle.improvements[0].estDefaut).toBe(true);
    expect(vehicle.improvements[0].price).toBe(0);
    expect(() => vehicle.removeImprovement(vehicle.improvements[0].id)).toThrow(DomainException);
  });

  it("reproduit l'arme par défaut montée sur Tourelle (estDefaut, prix 0)", () => {
    const team = makeTeam();
    const canon = makeWeaponType();
    const vehicle = team.addCampaignVehicle(makeVehicleType(), -5, [], canon);
    expect(vehicle.weapons).toHaveLength(1);
    expect(vehicle.weapons[0].estDefaut).toBe(true);
    expect(vehicle.weapons[0].orientation).toBe('tourelle');
    expect(vehicle.weapons[0].price).toBe(0);
  });

  it("l'id de l'équipement par défaut est distinct de l'id du véhicule et déterministe", () => {
    const team = makeTeam();
    const arceaux = makeImprovementType();
    const canon = makeWeaponType();
    const vehicle = team.addCampaignVehicle(makeVehicleTypeWithDefaults(), -5, [arceaux], canon);
    expect(vehicle.id).toBe(-5);
    expect(vehicle.improvements[0].id).not.toBe(vehicle.id);
    expect(vehicle.weapons[0].id).not.toBe(vehicle.id);
    expect(vehicle.improvements[0].id).not.toBe(vehicle.weapons[0].id);

    // Rejoué une seconde fois (même campaignId) : mêmes ids — condition nécessaire
    // à la reconstruction déterministe au replay (D-S11).
    const team2 = makeTeam();
    const vehicle2 = team2.addCampaignVehicle(makeVehicleTypeWithDefaults(), -5, [arceaux], canon);
    expect(vehicle2.improvements[0].id).toBe(vehicle.improvements[0].id);
    expect(vehicle2.weapons[0].id).toBe(vehicle.weapons[0].id);
  });

  it("les ids dérivés de deux véhicules différents ne collisionnent jamais", () => {
    const team = makeTeam();
    const arceaux = makeImprovementType();
    const canon = makeWeaponType();
    const v1 = team.addCampaignVehicle(makeVehicleTypeWithDefaults(), -5, [arceaux], canon);
    const v2 = team.addCampaignVehicle(makeVehicleTypeWithDefaults(), -6, [arceaux], canon);
    expect(v1.improvements[0].id).not.toBe(v2.improvements[0].id);
    expect(v1.weapons[0].id).not.toBe(v2.weapons[0].id);
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

// Régression : l'achat d'un véhicule (construction d'équipe) n'était gardé par aucune
// vérification de budget — un véhicule plus cher que le budget restant était accepté,
// laissant l'équipe en budget négatif.
describe('Team.addVehicle — garde budget', () => {
  it('refuse un véhicule dont le prix dépasse le budget restant', () => {
    const team = new Team(1, 42, 'Les Furieux', 'Rutherford', 10, null, []);
    expect(() => team.addVehicle(makeVehicleType(), [])).toThrow(DomainException);
    expect(team.vehicles).toHaveLength(0);
  });

  it('accepte un véhicule dont le prix ne dépasse pas le budget restant', () => {
    const team = new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, []);
    const vehicle = team.addVehicle(makeVehicleType(), []);
    expect(team.vehicles).toContain(vehicle);
  });

  it('le budget restant tient compte des véhicules déjà achetés', () => {
    // 50 de budget, un premier véhicule à 12 déjà acheté → il reste 38, largement
    // suffisant pour un second à 12 — vérifie que remainingBudget (pas cans) est utilisé.
    const team = new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, []);
    team.addVehicle(makeVehicleType(), []);
    expect(() => team.addVehicle(makeVehicleType(), [])).not.toThrow();
    expect(team.vehicles).toHaveLength(2);
  });
});

describe('Team.canAddVehicle — verdict de disponibilité (sans mutation)', () => {
  it('fail("Équipe verrouillée...") si l\'équipe est verrouillée, même avec assez de budget', () => {
    const team = new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, [], true);
    const result = team.canAddVehicle(makeVehicleType(), 50);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('verrouillée');
  });

  it('fail("...insuffisant") si le prix dépasse le budget fourni', () => {
    const team = new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, []);
    const result = team.canAddVehicle(makeVehicleType(), 5); // prix 12 > 5
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('insuffisant');
  });

  it('ok() si le budget fourni couvre le prix', () => {
    const team = new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, []);
    expect(team.canAddVehicle(makeVehicleType(), 12).ok).toBe(true);
  });

  it('le budget est injecté explicitement — indépendant de team.remainingBudget (atelier, cf. wallet)', () => {
    // Une équipe sans véhicule a remainingBudget = 50, mais le verdict doit suivre le
    // budget FOURNI (ex. cagnotte atelier), pas remainingBudget, pour rester réutilisable
    // côté GetWorkshopAvailableVehiclesUseCase.
    const team = new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, []);
    expect(team.canAddVehicle(makeVehicleType(), 3).ok).toBe(false);
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
