import { GameEvent } from './game-event';
import type { CampaignParticipant } from '../campaign-participant';
import { WalletReason } from '../enums/wallet-reason.enum';
import { GameEventType } from '../enums/game-event-type.enum';

/**
 * Mouvement de cagnotte (gain ou dépense).
 * `amount` peut être positif (gain) ou négatif (dépense).
 */
export class WalletMovementEvent extends GameEvent {
  readonly eventType = GameEventType.WALLET_MOVEMENT;

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

  execute(participants: CampaignParticipant[]): void {
    this.findParticipant(participants).creditWallet(this.amount);
  }

  undo(participants: CampaignParticipant[]): void {
    this.findParticipant(participants).creditWallet(-this.amount);
  }

  describe(): string {
    const sign = this.amount >= 0 ? '+' : '';
    return `Budget : ${sign}${this.amount} jerricans (${WALLET_REASON_LABELS[this.reason]})`;
  }
}

const WALLET_REASON_LABELS: Record<WalletReason, string> = {
  [WalletReason.RECOMPENSE]: 'Récompense',
  [WalletReason.ACHAT]: 'Achat atelier',
  [WalletReason.REVENTE]: 'Revente atelier',
};
