/**
 * Helpers partagés pour les tests du domaine campagne.
 * Fichier suffixé `.spec.ts` car uniquement importé depuis des fichiers de tests.
 */
import { Team } from '../../team/domain/team';
import { Vehicle } from '../../team/domain/vehicle';
import { Weapon } from '../../team/domain/weapon';
import { VehicleType } from '../../team/domain/value-objects/vehicle-type';
import { WeaponType } from '../../team/domain/value-objects/weapon-type';
import { SeasonParticipant } from './season-participant';

export function makeVehicleType(): VehicleType {
  return VehicleType.from({
    nom: 'Voiture', nom_interne: 'voiture', poids: 'Moyen',
    carrosserie: 6, manoeuvrabilite: 4, vitesse_max: 6, equipage: 2,
    emplacements: 4, prix: 12, description: '', regles: '', sponsors_autorises: [],
    ameliorations_defaut: [],
  });
}

export function makeWeaponType(): WeaponType {
  return WeaponType.from({
    nom: 'Mitrailleuse', nom_interne: 'mitrailleuse', type: 'base' as const,
    prix: 5, emplacement: 1, description: '', regles: '', sponsors_autorises: [],
  });
}

export interface TestContext {
  team: Team;
  vehicle: Vehicle;
  weapon: Weapon;
  participant: SeasonParticipant;
  participants: SeasonParticipant[];
}

/**
 * Construit un participant avec une équipe, un véhicule et une arme attachés.
 * La cagnotte initiale du participant est 50 (cans de l'équipe).
 */
export function makeTestParticipant(participantId = 1): TestContext {
  const weapon = new Weapon(10, makeWeaponType(), 'avant');
  const vehicle = new Vehicle(1, 1, makeVehicleType(), [weapon], []);
  const team = new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, [vehicle]);

  const participant = new SeasonParticipant(participantId, 42, 1, false);
  participant.attachTeam(team);

  return { team, vehicle, weapon, participant, participants: [participant] };
}
