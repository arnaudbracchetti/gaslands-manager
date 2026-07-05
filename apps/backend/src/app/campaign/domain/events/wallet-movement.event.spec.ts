import { describe, it, expect } from 'vitest';
import { WalletMovementEvent } from './wallet-movement.event';
import { WalletReason } from '../enums/wallet-reason.enum';
import { makeTestParticipant } from '../test-helpers';

describe('WalletMovementEvent — execute / undo', () => {
  it('execute crédite le wallet (gain positif)', () => {
    const { participant, participants } = makeTestParticipant();
    const before = participant.wallet;
    const event = new WalletMovementEvent(1, 10, participant.id, 1, 10, WalletReason.RECOMPENSE);
    event.execute(participants);
    expect(participant.wallet).toBe(before + 10);
  });

  it('execute débite le wallet (montant négatif)', () => {
    const { participant, participants } = makeTestParticipant();
    const before = participant.wallet;
    const event = new WalletMovementEvent(1, 10, participant.id, 1, -5, WalletReason.ACHAT);
    event.execute(participants);
    expect(participant.wallet).toBe(before - 5);
  });

  it('execute + undo → état identique', () => {
    const { participant, participants } = makeTestParticipant();
    const before = participant.wallet;
    const event = new WalletMovementEvent(1, 10, participant.id, 1, 15, WalletReason.RECOMPENSE);
    event.execute(participants);
    event.undo(participants);
    expect(participant.wallet).toBe(before);
  });

  it('describe() résume un gain', () => {
    const event = new WalletMovementEvent(1, 10, 1, 1, 10, WalletReason.RECOMPENSE);
    expect(event.describe()).toBe('+10 jerricans (RECOMPENSE)');
  });

  it('describe() résume une dépense', () => {
    const event = new WalletMovementEvent(1, 10, 1, 1, -5, WalletReason.ACHAT);
    expect(event.describe()).toBe('-5 jerricans (ACHAT)');
  });
});
