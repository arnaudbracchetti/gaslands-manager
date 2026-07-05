import { describe, it, expect } from 'vitest';
import { FavoriDuPublicBonusEvent } from './favori-du-public-bonus.event';
import { makeTestParticipant } from '../test-helpers';

describe('FavoriDuPublicBonusEvent — execute / undo', () => {
  it('crédite le propriétaire du véhicule de +5 PC', () => {
    const { participant, participants, vehicle } = makeTestParticipant();
    const event = new FavoriDuPublicBonusEvent(1, 10, participant.id, 1, vehicle.id, 5);
    event.execute(participants);
    expect(participant.championshipPoints).toBe(5);
  });

  it('undo annule les PC', () => {
    const { participant, participants, vehicle } = makeTestParticipant();
    const event = new FavoriDuPublicBonusEvent(1, 10, participant.id, 1, vehicle.id, 5);
    event.execute(participants);
    event.undo(participants);
    expect(participant.championshipPoints).toBe(0);
  });

  it('lève si participant introuvable', () => {
    const { participants } = makeTestParticipant();
    const event = new FavoriDuPublicBonusEvent(1, 10, 999, 1, 1, 5);
    expect(() => event.execute(participants)).toThrow('introuvable');
  });

  it('describe() résume le bonus', () => {
    const event = new FavoriDuPublicBonusEvent(1, 10, 1, 1, 1, 5);
    expect(event.describe()).toBe('Bonus Favori du public (+5 PC)');
  });
});
