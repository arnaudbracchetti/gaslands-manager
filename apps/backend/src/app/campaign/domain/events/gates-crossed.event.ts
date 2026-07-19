import { GameEvent } from './game-event';
import type { CampaignParticipant } from '../campaign-participant';
import { GameEventType } from '../enums/game-event-type.enum';

/**
 * Portes franchies par un participant pendant une partie (Course à la Mort,
 * p.167 : +1 PC par porte).
 *
 * `championshipPoints` est figé au moment de l'enregistrement (même raisonnement
 * D-S8 que `RankingAssignedEvent`) : un futur changement de barème n'affecte pas
 * les parties déjà jouées.
 */
export class GatesCrossedEvent extends GameEvent {
  readonly eventType = GameEventType.GATES_CROSSED;

  constructor(
    id: number,
    gameId: number,
    participantId: number,
    eventOrder: number,
    readonly gatesCrossed: number,
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
    return `${this.gatesCrossed} porte(s) franchie(s) (+${this.championshipPoints} PC)`;
  }
}
