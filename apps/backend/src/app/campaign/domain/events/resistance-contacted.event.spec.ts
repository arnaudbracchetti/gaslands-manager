import { describe, it, expect } from 'vitest';
import { ResistanceContactedEvent } from './resistance-contacted.event';
import { makeTestParticipant } from '../test-helpers';

describe('ResistanceContactedEvent — execute / undo', () => {
  it('execute ajoute +3 PR (secret)', () => {
    const { participant, participants } = makeTestParticipant();
    const event = new ResistanceContactedEvent(1, 10, participant.id, 1);
    event.execute(participants);
    expect(participant.resistancePoints).toBe(3);
  });

  it('undo retire les 3 PR', () => {
    const { participant, participants } = makeTestParticipant();
    const event = new ResistanceContactedEvent(1, 10, participant.id, 1);
    event.execute(participants);
    event.undo(participants);
    expect(participant.resistancePoints).toBe(0);
  });

  it('execute + undo → état identique', () => {
    const { participant, participants } = makeTestParticipant();
    const before = participant.resistancePoints;
    const event = new ResistanceContactedEvent(1, 10, participant.id, 1);
    event.execute(participants);
    event.undo(participants);
    expect(participant.resistancePoints).toBe(before);
  });
});
