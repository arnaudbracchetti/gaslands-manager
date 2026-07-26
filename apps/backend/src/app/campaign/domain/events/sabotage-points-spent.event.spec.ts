import { describe, it, expect } from 'vitest';
import { SabotagePointsSpentEvent } from './sabotage-points-spent.event';
import { makeTestParticipant } from '../test-helpers';

// Le clamp au solde disponible vit désormais dans Game.recordSabotageSpent (cf.
// game.spec.ts) — cette classe ne fait plus que porter la valeur déjà résolue.
describe('SabotagePointsSpentEvent — execute / undo', () => {
  it('execute débite 3 Points de Résistance par point de sabotage dépensé', () => {
    const { participant, participants } = makeTestParticipant();
    const event = new SabotagePointsSpentEvent(1, 10, participant.id, 1, 2);

    event.execute(participants);

    expect(participant.resistancePoints).toBe(-6);
  });

  it('undo restitue exactement ce qui a été débité', () => {
    const { participant, participants } = makeTestParticipant();
    participant.addResistance(9);
    const event = new SabotagePointsSpentEvent(1, 10, participant.id, 1, 3);

    event.execute(participants);
    event.undo(participants);

    expect(participant.resistancePoints).toBe(9);
  });

  it('execute + undo → état identique à l\'initial', () => {
    const { participant, participants } = makeTestParticipant();
    participant.addResistance(9);
    const before = participant.resistancePoints;
    const event = new SabotagePointsSpentEvent(1, 10, participant.id, 1, 3);

    event.execute(participants);
    event.undo(participants);

    expect(participant.resistancePoints).toBe(before);
  });

  it('describe() résume le montant réellement appliqué (déjà clampé)', () => {
    const event = new SabotagePointsSpentEvent(1, 10, 1, 1, 3);
    expect(event.describe()).toBe('Sabotage : 3 point(s) de sabotage dépensé(s)');
  });
});
