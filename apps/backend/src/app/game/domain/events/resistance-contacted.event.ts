import { GameEvent } from './game-event';
import type { SeasonParticipant } from '../season-participant';

/**
 * Un participant a contacté la Résistance — +3 Points de Résistance (secret).
 * Les PR ne sont jamais exposés au classement public (cf. standings()).
 */
export class ResistanceContactedEvent extends GameEvent {
  private static readonly PR_BONUS = 3;

  constructor(
    id: number,
    gameId: number,
    participantId: number,
    eventOrder: number,
  ) {
    super(id, gameId, participantId, eventOrder);
  }

  execute(participants: SeasonParticipant[]): void {
    this.findParticipant(participants).addResistance(ResistanceContactedEvent.PR_BONUS);
  }

  undo(participants: SeasonParticipant[]): void {
    this.findParticipant(participants).addResistance(-ResistanceContactedEvent.PR_BONUS);
  }
}
