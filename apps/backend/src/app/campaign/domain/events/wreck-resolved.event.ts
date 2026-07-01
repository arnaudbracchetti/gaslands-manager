import { GameEvent } from './game-event';
import type { CampaignParticipant } from '../campaign-participant';
import { WreckResult } from '../enums/wreck-result.enum';

/**
 * Résultat du lancer de la Table des Épaves — snapshot figé (D-S9).
 *
 * Stocke le résultat brut du D6 + la ligne de table appliquée. Les effets concrets
 * (VehicleLostEvent, WeaponLostEvent) sont créés séparément par WreckResolveUseCase
 * et persistés comme événements distincts. Celui-ci n'applique que les Chocs.
 */
export class WreckResolvedEvent extends GameEvent {
  constructor(
    id: number,
    gameId: number,
    participantId: number,
    eventOrder: number,
    readonly vehicleId: number,
    readonly diceRoll: number,
    readonly chocsBefore: number,
    readonly wreckResult: WreckResult,
    readonly chocsGained: number,
  ) {
    super(id, gameId, participantId, eventOrder);
  }

  execute(participants: CampaignParticipant[]): void {
    const p = this.findParticipant(participants);
    p.team.findVehicle(this.vehicleId).addChocs(this.chocsGained);
  }

  undo(participants: CampaignParticipant[]): void {
    const p = this.findParticipant(participants);
    p.team.findVehicle(this.vehicleId).addChocs(-this.chocsGained);
  }
}
