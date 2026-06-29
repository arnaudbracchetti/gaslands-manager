import { GameEvent } from './game-event';
import type { SeasonParticipant } from '../season-participant';

/**
 * Classement d'un participant après une partie.
 *
 * `championshipPoints` est figé au moment de l'enregistrement (D-S8) : un changement
 * futur des règles de calcul n'affecte pas les résultats passés.
 */
export class RankingAssignedEvent extends GameEvent {
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

  execute(participants: SeasonParticipant[]): void {
    this.findParticipant(participants).addPoints(this.championshipPoints);
  }

  undo(participants: SeasonParticipant[]): void {
    this.findParticipant(participants).addPoints(-this.championshipPoints);
  }
}
