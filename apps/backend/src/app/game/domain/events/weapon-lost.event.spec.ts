import { describe, it, expect } from 'vitest';
import { WeaponLostEvent } from './weapon-lost.event';
import { makeTestParticipant } from '../test-helpers';

describe('WeaponLostEvent — execute / undo', () => {
  it('execute marque l\'arme comme perdue', () => {
    const { participant, participants, weapon } = makeTestParticipant();
    const event = new WeaponLostEvent(1, 10, participant.id, 1, weapon.id);
    event.execute(participants);
    expect(weapon.isLost).toBe(true);
  });

  it('undo remet l\'arme active', () => {
    const { participant, participants, weapon } = makeTestParticipant();
    const event = new WeaponLostEvent(1, 10, participant.id, 1, weapon.id);
    event.execute(participants);
    event.undo(participants);
    expect(weapon.isLost).toBe(false);
  });

  it('execute + undo → état identique', () => {
    const { participant, participants, weapon } = makeTestParticipant();
    const before = weapon.isLost;
    const event = new WeaponLostEvent(1, 10, participant.id, 1, weapon.id);
    event.execute(participants);
    event.undo(participants);
    expect(weapon.isLost).toBe(before);
  });
});
