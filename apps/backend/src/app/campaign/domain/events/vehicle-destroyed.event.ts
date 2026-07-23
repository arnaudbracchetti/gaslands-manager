import { GameEvent } from './game-event';
import type { CampaignParticipant } from '../campaign-participant';
import { WeightClass } from '../enums/weight-class.enum';
import { GameEventType } from '../enums/game-event-type.enum';

/**
 * Un véhicule ennemi a été détruit par poids pendant une partie (Course à la
 * Mort, p.167 : +1/+2/+3/+5 PC pour Léger/Moyen/Lourd/Forteresse).
 *
 * `vehicleId` est purement informatif (trace de quel véhicule a été détruit) —
 * ne mute jamais l'état de ce véhicule (pas de `markLost`, contrairement à
 * `VehicleLostEvent`). `participantId` désigne le **destructeur**, crédité des
 * PC, pas le propriétaire du véhicule détruit. `championshipPoints` est figé au
 * moment de l'enregistrement (même raisonnement D-S8 que `RankingAssignedEvent`).
 */
export class VehicleDestroyedEvent extends GameEvent {
  readonly eventType = GameEventType.VEHICLE_DESTROYED;

  constructor(
    id: number,
    gameId: number,
    participantId: number,
    eventOrder: number,
    readonly vehicleId: number,
    readonly weightClass: WeightClass,
    readonly championshipPoints: number,
  ) {
    super(id, gameId, participantId, eventOrder);
  }

  execute(participants: CampaignParticipant[]): void {
    this.findParticipant(participants).addPoints(this.championshipPoints);
  }

  undo(participants: CampaignParticipant[]): void {
    this.findParticipant(participants).addPoints(-this.championshipPoints);
  }

  describe(participants: readonly CampaignParticipant[]): string {
    const found = this.findVehicleWithTeam(participants, this.vehicleId);
    const label = found ? `${found.vehicle.type.nom} (${found.team.name})` : `#${this.vehicleId}`;
    // Escarmouche (Game.recordDestroyedVehicleTraces) fige toujours 0 PC : la destruction
    // reste tracée dans le journal, sans afficher un gain de PC inexistant.
    const suffix = this.championshipPoints > 0 ? ` (+${this.championshipPoints} PC)` : '';
    return `Véhicule ennemi détruit : ${label} - ${WEIGHT_CLASS_LABELS[this.weightClass]}${suffix}`;
  }
}

const WEIGHT_CLASS_LABELS: Record<WeightClass, string> = {
  [WeightClass.LEGER]: 'Léger',
  [WeightClass.MOYEN]: 'Moyen',
  [WeightClass.LOURD]: 'Lourd',
  [WeightClass.FORTERESSE]: 'Forteresse',
};
