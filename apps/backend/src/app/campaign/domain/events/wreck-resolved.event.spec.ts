import { describe, it, expect } from 'vitest';
import { WreckResolvedEvent } from './wreck-resolved.event';
import { WreckResult } from '../enums/wreck-result.enum';
import { makeTestParticipant } from '../test-helpers';

describe('WreckResolvedEvent — execute / undo', () => {
  it('execute ajoute des chocs au véhicule', () => {
    const { participant, participants, vehicle } = makeTestParticipant();
    const event = new WreckResolvedEvent(1, 10, participant.id, 1, vehicle.id, 4, 0, WreckResult.CHOCS_GAGNE, 3);
    event.execute(participants);
    expect(vehicle.chocs).toBe(3);
  });

  it('undo retire les chocs ajoutés', () => {
    const { participant, participants, vehicle } = makeTestParticipant();
    const event = new WreckResolvedEvent(1, 10, participant.id, 1, vehicle.id, 4, 0, WreckResult.CHOCS_GAGNE, 3);
    event.execute(participants);
    event.undo(participants);
    expect(vehicle.chocs).toBe(0);
  });

  it('execute + undo → état identique', () => {
    const { participant, participants, vehicle } = makeTestParticipant();
    const before = vehicle.chocs;
    const event = new WreckResolvedEvent(1, 10, participant.id, 1, vehicle.id, 6, 2, WreckResult.ARME_PERDUE, 2);
    event.execute(participants);
    event.undo(participants);
    expect(vehicle.chocs).toBe(before);
  });
});
