import { describe, it, expect } from 'vitest';
import { SabotageConvertedEvent } from './sabotage-converted.event';
import { makeTestParticipant } from '../test-helpers';

describe('SabotageConvertedEvent — execute / undo', () => {
  it('execute débite 3 PR par jeton converti et crédite les jerricans figés dans l\'événement', () => {
    const { participant, participants } = makeTestParticipant();
    participant.addResistance(6);
    const walletBefore = participant.wallet;
    const event = new SabotageConvertedEvent(1, 10, participant.id, 1, 1, 3);

    event.execute(participants);

    expect(participant.resistancePoints).toBe(3);
    expect(participant.sabotagePoints).toBe(1);
    expect(participant.wallet).toBe(walletBefore + 3);
  });

  it('execute + undo → état identique à l\'initial', () => {
    const { participant, participants } = makeTestParticipant();
    participant.addResistance(6);
    const resistanceBefore = participant.resistancePoints;
    const walletBefore = participant.wallet;
    const event = new SabotageConvertedEvent(1, 10, participant.id, 1, 1, 3);

    event.execute(participants);
    event.undo(participants);

    expect(participant.resistancePoints).toBe(resistanceBefore);
    expect(participant.wallet).toBe(walletBefore);
  });

  it('ne compte pas comme récompense plafonnée (R4)', () => {
    const event = new SabotageConvertedEvent(1, 10, 1, 1, 1, 3);

    expect(event.recompenseJerricansAwarded).toBe(0);
  });

  it('describe() résume la conversion', () => {
    const event = new SabotageConvertedEvent(1, 10, 1, 1, 1, 3);

    expect(event.describe()).toBe('Sabotage : 1 jeton(s) converti(s) en 3 jerricans');
  });
});
