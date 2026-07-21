import { describe, it, expect } from 'vitest';
import { FavoriDuPublicBonusEvent } from './favori-du-public-bonus.event';
import { makeTestParticipant } from '../test-helpers';

describe('FavoriDuPublicBonusEvent — execute / undo', () => {
  it('crédite le propriétaire du véhicule de +5 PC et consomme le statut', () => {
    const { participant, participants, vehicle } = makeTestParticipant();
    vehicle.markFavoriDuPublic();
    const event = new FavoriDuPublicBonusEvent(1, 10, participant.id, 1, vehicle.id, 5);
    event.execute(participants);
    expect(participant.championshipPoints).toBe(5);
    expect(vehicle.hasFavoriDuPublic).toBe(false);
  });

  it('undo annule les PC et restaure le statut', () => {
    const { participant, participants, vehicle } = makeTestParticipant();
    vehicle.markFavoriDuPublic();
    const event = new FavoriDuPublicBonusEvent(1, 10, participant.id, 1, vehicle.id, 5);
    event.execute(participants);
    event.undo(participants);
    expect(participant.championshipPoints).toBe(0);
    expect(vehicle.hasFavoriDuPublic).toBe(true);
  });

  it('lève si participant introuvable', () => {
    const { participants } = makeTestParticipant();
    const event = new FavoriDuPublicBonusEvent(1, 10, 999, 1, 1, 5);
    expect(() => event.execute(participants)).toThrow('introuvable');
  });

  it('lève si le véhicule est introuvable', () => {
    const { participant, participants } = makeTestParticipant();
    const event = new FavoriDuPublicBonusEvent(1, 10, participant.id, 1, 999, 5);
    expect(() => event.execute(participants)).toThrow('introuvable');
  });

  it('describe() résume le bonus, avec le nom du véhicule', () => {
    const { participant, participants, vehicle } = makeTestParticipant();
    const event = new FavoriDuPublicBonusEvent(1, 10, participant.id, 1, vehicle.id, 5);
    expect(event.describe(participants)).toBe('Bonus Favori du public : Voiture (+5 PC)');
  });

  it('describe() sans véhicule résolu (cas limite) omet le nom', () => {
    const event = new FavoriDuPublicBonusEvent(1, 10, 1, 1, 999, 5);
    expect(event.describe([])).toBe('Bonus Favori du public (+5 PC)');
  });
});
