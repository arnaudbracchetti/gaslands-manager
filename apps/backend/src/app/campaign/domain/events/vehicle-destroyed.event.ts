import { GameEvent } from './game-event';
import type { CampaignParticipant } from '../campaign-participant';
import { WeightClass } from '../enums/weight-class.enum';

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

  describe(): string {
    return `Véhicule ennemi détruit (${this.weightClass}) (+${this.championshipPoints} PC)`;
  }
}
