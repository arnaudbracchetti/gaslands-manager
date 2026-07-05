import { describe, it, expect } from 'vitest';
import { VehicleLostEvent } from './vehicle-lost.event';
import { makeTestParticipant } from '../test-helpers';

describe('VehicleLostEvent — execute / undo', () => {
  it('execute marque le véhicule comme perdu', () => {
    const { participant, participants, vehicle } = makeTestParticipant();
    const event = new VehicleLostEvent(1, 10, participant.id, 1, vehicle.id);
    event.execute(participants);
    expect(vehicle.isLost).toBe(true);
  });

  it('undo remet le véhicule en jeu', () => {
    const { participant, participants, vehicle } = makeTestParticipant();
    const event = new VehicleLostEvent(1, 10, participant.id, 1, vehicle.id);
    event.execute(participants);
    event.undo(participants);
    expect(vehicle.isLost).toBe(false);
  });

  it('execute + undo → état identique', () => {
    const { participant, participants, vehicle } = makeTestParticipant();
    const before = vehicle.isLost;
    const event = new VehicleLostEvent(1, 10, participant.id, 1, vehicle.id);
    event.execute(participants);
    event.undo(participants);
    expect(vehicle.isLost).toBe(before);
  });

  it('describe() décrit la perte du véhicule', () => {
    const event = new VehicleLostEvent(1, 10, 1, 1, 1);
    expect(event.describe()).toBe('Véhicule détruit');
  });
});
