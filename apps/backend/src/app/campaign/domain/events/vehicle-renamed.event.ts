import { GameEvent } from './game-event';
import type { CampaignParticipant } from '../campaign-participant';

/**
 * Un véhicule est renommé en Atelier (mode campagne) — mécanisme uniforme, que le
 * véhicule ciblé soit pré-existant (id positif) ou transient de la session en cours
 * (id négatif, D-S11) : `Team.renameCampaignVehicle`/`findVehicle` ne font aucune
 * distinction de signe (cf. spec/CAMPAIGN.md — Renommage d'un véhicule en atelier,
 * §Pourquoi un événement plutôt qu'une écriture directe — une écriture directe
 * romprait l'invariante "l'atelier ne persiste jamais hors du journal").
 *
 * `previousName`/`newName` sont TOUJOURS des chaînes concrètes (jamais `null`) —
 * `previousName` est capturé via `Vehicle.nom` (déjà résolu avec fallback sur le
 * type), donc `undo()` restaure la même valeur affichée même si le véhicule n'avait
 * jamais été renommé avant cet événement.
 *
 * `targetsVehicle()` est surchargée (mirroir d'`EquipmentChangedEvent`,
 * `equipment-changed.event.ts:293`) : un véhicule acheté PUIS renommé PUIS dont
 * l'achat est annulé dans la même session doit voir CET événement supprimé en
 * cascade par `Game.collectSessionEventsForVehicle` — sans quoi il resterait
 * orphelin dans le journal et le prochain replay lèverait une `DomainException`
 * sur `Team.findVehicle`.
 */
export class VehicleRenamedEvent extends GameEvent {
  constructor(
    id: number,
    gameId: number,
    participantId: number,
    eventOrder: number,
    readonly vehicleId: number,
    readonly previousName: string,
    readonly newName: string,
  ) {
    super(id, gameId, participantId, eventOrder);
  }

  execute(participants: CampaignParticipant[]): void {
    const p = this.findParticipant(participants);
    p.team.renameCampaignVehicle(this.vehicleId, this.newName);
  }

  undo(participants: CampaignParticipant[]): void {
    const p = this.findParticipant(participants);
    p.team.renameCampaignVehicle(this.vehicleId, this.previousName);
  }

  override targetsVehicle(vehicleId: number): boolean {
    return this.vehicleId === vehicleId;
  }

  describe(participants: readonly CampaignParticipant[]): string {
    const typeNom = this.findVehicleWithTeam(participants, this.vehicleId)?.vehicle.type.nom;
    return `Renommage${typeNom ? ` (${typeNom})` : ''} : "${this.previousName}" → "${this.newName}"`;
  }
}
