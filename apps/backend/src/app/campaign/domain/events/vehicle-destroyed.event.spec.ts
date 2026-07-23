import { describe, it, expect } from 'vitest';
import { VehicleDestroyedEvent } from './vehicle-destroyed.event';
import { WeightClass } from '../enums/weight-class.enum';
import { makeTestParticipant } from '../test-helpers';

describe('VehicleDestroyedEvent — execute / undo', () => {
  it('crédite le destructeur (participantId de l\'événement), pas le propriétaire du véhicule', () => {
    const { participant, participants } = makeTestParticipant();
    const event = new VehicleDestroyedEvent(1, 10, participant.id, 1, 999, WeightClass.LOURD, 3);
    event.execute(participants);
    expect(participant.championshipPoints).toBe(3);
  });

  it('ne mute pas l\'état du véhicule ciblé (pas de markLost)', () => {
    const { participant, participants, vehicle } = makeTestParticipant();
    const event = new VehicleDestroyedEvent(1, 10, participant.id, 1, vehicle.id, WeightClass.LEGER, 1);
    event.execute(participants);
    expect(vehicle.isLost).toBe(false);
  });

  it('undo annule les PC', () => {
    const { participant, participants } = makeTestParticipant();
    const event = new VehicleDestroyedEvent(1, 10, participant.id, 1, 999, WeightClass.FORTERESSE, 5);
    event.execute(participants);
    event.undo(participants);
    expect(participant.championshipPoints).toBe(0);
  });

  it('lève si participant introuvable', () => {
    const { participants } = makeTestParticipant();
    const event = new VehicleDestroyedEvent(1, 10, 999, 1, 1, WeightClass.MOYEN, 2);
    expect(() => event.execute(participants)).toThrow('introuvable');
  });

  it('describe() résume le véhicule, l\'équipe, le poids et les PC gagnés', () => {
    const { participant, participants, vehicle } = makeTestParticipant();
    const event = new VehicleDestroyedEvent(1, 10, participant.id, 1, vehicle.id, WeightClass.LOURD, 3);
    expect(event.describe(participants)).toBe('Véhicule ennemi détruit : Voiture (Les Furieux) - Lourd (+3 PC)');
  });

  it('describe() sans véhicule résolu (cas limite) retombe sur l\'id', () => {
    const event = new VehicleDestroyedEvent(1, 10, 1, 1, 999, WeightClass.LOURD, 3);
    expect(event.describe([])).toBe('Véhicule ennemi détruit : #999 - Lourd (+3 PC)');
  });

  it('describe() omet le suffixe PC quand championshipPoints = 0 (trace Escarmouche)', () => {
    const { participant, participants, vehicle } = makeTestParticipant();
    const event = new VehicleDestroyedEvent(1, 10, participant.id, 1, vehicle.id, WeightClass.LOURD, 0);
    expect(event.describe(participants)).toBe('Véhicule ennemi détruit : Voiture (Les Furieux) - Lourd');
  });
});
