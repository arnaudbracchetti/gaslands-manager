import { GameEvent } from './game-event';
import type { CampaignParticipant } from '../campaign-participant';

/**
 * Un véhicule est perdu (détruit ou hors-combat) pendant la campagne.
 * Pose un flag transient sur le véhicule en mémoire — jamais persisté.
 */
export class VehicleLostEvent extends GameEvent {
  constructor(
    id: number,
    gameId: number,
    participantId: number,
    eventOrder: number,
    readonly vehicleId: number,
  ) {
    super(id, gameId, participantId, eventOrder);
  }

  execute(participants: CampaignParticipant[]): void {
    const p = this.findParticipant(participants);
    p.team.findVehicle(this.vehicleId).markLost();
  }

  undo(participants: CampaignParticipant[]): void {
    const p = this.findParticipant(participants);
    p.team.findVehicle(this.vehicleId).clearLost();
  }

  describe(participants: readonly CampaignParticipant[]): string {
    const found = this.findVehicleWithTeam(participants, this.vehicleId);
    return `Véhicule détruit : ${found?.vehicle.type.nom ?? `#${this.vehicleId}`}`;
  }
}
