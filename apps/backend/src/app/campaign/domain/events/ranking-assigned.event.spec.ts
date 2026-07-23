import { describe, it, expect } from 'vitest';
import { RankingAssignedEvent } from './ranking-assigned.event';
import { CampaignParticipant } from '../campaign-participant';
import { makeTestParticipant } from '../test-helpers';

describe('RankingAssignedEvent — execute / undo', () => {
  it('execute ajoute les PC au participant', () => {
    const { participant, participants } = makeTestParticipant();
    const event = new RankingAssignedEvent(1, 10, participant.id, 1, 1, 8);
    event.execute(participants);
    expect(participant.championshipPoints).toBe(8);
  });

  it('undo annule les PC', () => {
    const { participant, participants } = makeTestParticipant();
    const event = new RankingAssignedEvent(1, 10, participant.id, 1, 1, 8);
    event.execute(participants);
    event.undo(participants);
    expect(participant.championshipPoints).toBe(0);
  });

  it('execute + undo → état identique à l\'initial', () => {
    const { participant, participants } = makeTestParticipant();
    const before = participant.championshipPoints;
    const event = new RankingAssignedEvent(1, 10, participant.id, 1, 2, 12);
    event.execute(participants);
    event.undo(participants);
    expect(participant.championshipPoints).toBe(before);
  });

  it('lève si participant introuvable', () => {
    const { participants } = makeTestParticipant();
    const event = new RankingAssignedEvent(1, 10, 999, 1, 1, 5);
    expect(() => event.execute(participants)).toThrow('introuvable');
  });

  it('describe() résume le classement et les PC', () => {
    const event = new RankingAssignedEvent(1, 10, 1, 1, 2, 5);
    expect(event.describe()).toBe('Classement : véhicule classé 2 (+5 PC)');
  });
});
