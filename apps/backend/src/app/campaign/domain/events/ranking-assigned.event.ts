import { GameEvent } from './game-event';
import type { CampaignParticipant } from '../campaign-participant';
import { GameEventType } from '../enums/game-event-type.enum';

/**
 * Classement d'un participant après une partie.
 *
 * `championshipPoints` est figé au moment de l'enregistrement (D-S8) : un changement
 * futur des règles de calcul n'affecte pas les résultats passés.
 */
export class RankingAssignedEvent extends GameEvent {
  readonly eventType = GameEventType.RANKING_ASSIGNED;

  constructor(
    id: number,
    gameId: number,
    participantId: number,
    eventOrder: number,
    readonly rank: number,
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
    return `Classement : véhicule classé ${this.rank} (+${this.championshipPoints} PC)`;
  }
}
