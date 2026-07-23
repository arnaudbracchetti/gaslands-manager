import { describe, it, expect } from 'vitest';
import { GatesCrossedEvent } from './gates-crossed.event';
import { makeTestParticipant } from '../test-helpers';

describe('GatesCrossedEvent — execute / undo', () => {
  it('execute ajoute les PC au participant', () => {
    const { participant, participants } = makeTestParticipant();
    const event = new GatesCrossedEvent(1, 10, participant.id, 1, 3, 3);
    event.execute(participants);
    expect(participant.championshipPoints).toBe(3);
  });

  it('undo annule les PC', () => {
    const { participant, participants } = makeTestParticipant();
    const event = new GatesCrossedEvent(1, 10, participant.id, 1, 3, 3);
    event.execute(participants);
    event.undo(participants);
    expect(participant.championshipPoints).toBe(0);
  });

  it('execute + undo → état identique à l\'initial', () => {
    const { participant, participants } = makeTestParticipant();
    const before = participant.championshipPoints;
    const event = new GatesCrossedEvent(1, 10, participant.id, 1, 5, 5);
    event.execute(participants);
    event.undo(participants);
    expect(participant.championshipPoints).toBe(before);
  });

  it('lève si participant introuvable', () => {
    const { participants } = makeTestParticipant();
    const event = new GatesCrossedEvent(1, 10, 999, 1, 3, 3);
    expect(() => event.execute(participants)).toThrow('introuvable');
  });

  it('describe() résume les portes franchies et les PC', () => {
    const event = new GatesCrossedEvent(1, 10, 1, 1, 3, 3);
    expect(event.describe()).toBe('Porte(s) franchie(s) : 3 porte(s) (+3 PC)');
  });
});
