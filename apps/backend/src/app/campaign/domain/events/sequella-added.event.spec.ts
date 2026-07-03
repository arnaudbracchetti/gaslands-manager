import { describe, it, expect } from 'vitest';
import { SequellaAddedEvent } from './sequella-added.event';
import { makeTestParticipant } from '../test-helpers';
import { SEQUELLA_MOTEUR_ENDOMMAGE } from '../../../team/domain/sequella-decorators';

describe('SequellaAddedEvent — execute / undo', () => {
  it('execute ajoute la séquelle et dépense des Chocs', () => {
    const { participant, participants, vehicle } = makeTestParticipant();
    vehicle.addChocs(5);

    const event = new SequellaAddedEvent(1, 10, participant.id, 1, vehicle.id, 'moteur_endommage', 2);
    event.execute(participants);

    expect(vehicle.sequellas).toHaveLength(1);
    expect(vehicle.sequellas[0].equals(SEQUELLA_MOTEUR_ENDOMMAGE)).toBe(true);
    expect(vehicle.chocs).toBe(3); // 5 - 2
  });

  it('undo retire la dernière séquelle et restitue les Chocs', () => {
    const { participant, participants, vehicle } = makeTestParticipant();
    vehicle.addChocs(5);

    const event = new SequellaAddedEvent(1, 10, participant.id, 1, vehicle.id, 'moteur_endommage', 2);
    event.execute(participants);
    event.undo(participants);

    expect(vehicle.sequellas).toHaveLength(0);
    expect(vehicle.chocs).toBe(5); // restitué
  });

  it('execute + undo → état identique', () => {
    const { participant, participants, vehicle } = makeTestParticipant();
    vehicle.addChocs(4);
    const beforeChocs = vehicle.chocs;
    const beforeSequellas = vehicle.sequellas.length;

    const event = new SequellaAddedEvent(1, 10, participant.id, 1, vehicle.id, 'moteur_endommage', 2);
    event.execute(participants);
    event.undo(participants);

    expect(vehicle.chocs).toBe(beforeChocs);
    expect(vehicle.sequellas).toHaveLength(beforeSequellas);
  });

  it('lève DomainException si la séquelle est inconnue', () => {
    const { participant, participants } = makeTestParticipant();
    const event = new SequellaAddedEvent(1, 10, participant.id, 1, 1, 'inconnue_xyz', 2);
    expect(() => event.execute(participants)).toThrow('inconnue');
  });

  it('lève DomainException si chocs insuffisants (via Vehicle.addChocs)', () => {
    const { participant, participants, vehicle } = makeTestParticipant();
    // vehicle.chocs = 0, demande 2 → addChocs(-2) lève
    const event = new SequellaAddedEvent(1, 10, participant.id, 1, vehicle.id, 'moteur_endommage', 2);
    expect(() => event.execute(participants)).toThrow('insuffisants');
  });
});
