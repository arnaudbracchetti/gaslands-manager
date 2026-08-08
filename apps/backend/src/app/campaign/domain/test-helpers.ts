/**
 * Helpers partagés pour les tests du domaine campagne.
 * Fichier suffixé `.spec.ts` car uniquement importé depuis des fichiers de tests.
 */
import { Team } from '../../team/domain/team';
import { Vehicle } from '../../team/domain/vehicle';
import { Weapon } from '../../team/domain/weapon';
import { Improvement } from '../../team/domain/improvement';
import { Advantage } from '../../team/domain/advantage';
import { VehicleType } from '../../team/domain/value-objects/vehicle-type';
import { WeaponType } from '../../team/domain/value-objects/weapon-type';
import { ImprovementType } from '../../team/domain/value-objects/improvement-type';
import { AdvantageType } from '../../team/domain/value-objects/advantage-type';
import { CampaignParticipant } from './campaign-participant';

export function makeVehicleType(poids: 'Léger' | 'Moyen' | 'Lourd' = 'Moyen'): VehicleType {
  return VehicleType.from({
    nom: 'Voiture', nom_interne: 'voiture', poids,
    carrosserie: 6, manoeuvrabilite: 4, vitesse_max: 6, equipage: 2,
    emplacements: 4, prix: 12, description: '', regles: '', sponsors_autorises: [],
    ameliorations_defaut: [],
  });
}

export function makeWeaponType(): WeaponType {
  return WeaponType.from({
    nom: 'Mitrailleuse', nom_interne: 'mitrailleuse', type: 'base' as const,
    prix: 5, emplacement: 1, description: '', regles: '', sponsors_autorises: [],
    necessite_orientation: true,
  });
}

export function makeImprovementType(): ImprovementType {
  return ImprovementType.from({
    nom: 'Blindage', nom_interne: 'blindage',
    prix: 4, emplacement: 1, description: '', regles: '', sponsors_autorises: [],
    necessite_orientation: false,
  });
}

export function makeAdvantageType(): AdvantageType {
  return AdvantageType.from({
    nom: 'Tireur d\'Élite', nom_interne: 'tireur_elite', categorie: 'Militaire',
    prix: 2, description: '', regles: '',
  });
}

/**
 * Équipe minimale sans véhicule (vehiclesCost = 0) - pour les tests qui n'exercent
 * que la navigation/appartenance d'équipe (requestJoin, changeParticipantTeam) sans
 * se soucier du coût réel. `cans` par défaut 50, comme `Team.cans`.
 */
export function makeTeam(id: number, cans = 50): Team {
  return new Team(id, 42, `Équipe ${id}`, 'Rutherford', cans, null, []);
}

/** Mirroir de `makeTeam`, avec des véhicules fournis - pour tester le budget de campagne (`Team.vehiclesCost`). */
export function makeTeamWithVehicles(id: number, vehicles: Vehicle[], cans = 50): Team {
  return new Team(id, 42, `Équipe ${id}`, 'Rutherford', cans, null, vehicles);
}

export interface TestContext {
  team: Team;
  vehicle: Vehicle;
  weapon: Weapon;
  improvement: Improvement;
  participant: CampaignParticipant;
  participants: CampaignParticipant[];
}

export interface TestContextWithAdvantage extends TestContext {
  advantage: Advantage;
}

/**
 * Construit un participant avec une équipe, un véhicule, une arme et une amélioration
 * attachés. Coût du build : 12 (véhicule) + 5 (arme) + 4 (amélioration) = 21.
 * La cagnotte initiale du participant est donc 29 (remainingBudget = cans 50 − build 21).
 */
export function makeTestParticipant(participantId = 1): TestContext {
  const weapon = new Weapon(10, makeWeaponType(), 'avant');
  const improvement = new Improvement(20, makeImprovementType(), null, false);
  const vehicle = new Vehicle(1, 1, makeVehicleType(), [weapon], [improvement]);
  const team = new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, [vehicle]);

  const participant = new CampaignParticipant(participantId, 42, 1, false);
  participant.attachTeam(team);

  return { team, vehicle, weapon, improvement, participant, participants: [participant] };
}

/**
 * Mirroir de `makeTestParticipant`, ÉTENDU d'un avantage pré-existant (id positif —
 * distinct de `makeTestParticipant` pour ne pas changer le coût de build de 21 déjà
 * référencé en dur dans d'autres specs, ex. `wallet === 29`). Coût du build : 12
 * (véhicule) + 5 (arme) + 4 (amélioration) + 2 (avantage) = 23. Cagnotte initiale : 27.
 */
export function makeTestParticipantWithAdvantage(participantId = 1): TestContextWithAdvantage {
  const weapon = new Weapon(10, makeWeaponType(), 'avant');
  const improvement = new Improvement(20, makeImprovementType(), null, false);
  const advantage = new Advantage(30, makeAdvantageType());
  const vehicle = new Vehicle(1, 1, makeVehicleType(), [weapon], [improvement], [advantage]);
  const team = new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, [vehicle]);

  const participant = new CampaignParticipant(participantId, 42, 1, false);
  participant.attachTeam(team);

  return { team, vehicle, weapon, improvement, advantage, participant, participants: [participant] };
}
