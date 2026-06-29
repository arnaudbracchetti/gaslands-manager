import { GameEvent } from './game-event';
import type { SeasonParticipant } from '../season-participant';
import { WalletReason } from '../enums/wallet-reason.enum';

/**
 * Mouvement de cagnotte (gain ou dépense).
 * `amount` peut être positif (gain) ou négatif (dépense).
 */
export class WalletMovementEvent extends GameEvent {
  constructor(
    id: number,
    gameId: number,
    participantId: number,
    eventOrder: number,
    readonly amount: number,
    readonly reason: WalletReason,
  ) {
    super(id, gameId, participantId, eventOrder);
  }

  execute(participants: SeasonParticipant[]): void {
    this.findParticipant(participants).creditWallet(this.amount);
  }

  undo(participants: SeasonParticipant[]): void {
    this.findParticipant(participants).creditWallet(-this.amount);
  }
}
