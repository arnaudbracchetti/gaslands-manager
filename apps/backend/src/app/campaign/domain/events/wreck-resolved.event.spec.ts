import { describe, it, expect } from 'vitest';
import { WreckResolvedEvent } from './wreck-resolved.event';
import { WreckResult } from '../enums/wreck-result.enum';
import { makeTestParticipant } from '../test-helpers';

describe('WreckResolvedEvent — execute / undo', () => {
  it('execute ajoute des chocs au véhicule', () => {
    const { participant, participants, vehicle } = makeTestParticipant();
    const event = new WreckResolvedEvent(1, 10, participant.id, 1, vehicle.id, 4, 0, WreckResult.ROUE_CABOSSEE, 3);
    event.execute(participants);
    expect(vehicle.chocs).toBe(3);
  });

  it('undo retire les chocs ajoutés', () => {
    const { participant, participants, vehicle } = makeTestParticipant();
    const event = new WreckResolvedEvent(1, 10, participant.id, 1, vehicle.id, 4, 0, WreckResult.ROUE_CABOSSEE, 3);
    event.execute(participants);
    event.undo(participants);
    expect(vehicle.chocs).toBe(0);
  });

  it('execute + undo → état identique', () => {
    const { participant, participants, vehicle } = makeTestParticipant();
    const before = vehicle.chocs;
    const event = new WreckResolvedEvent(1, 10, participant.id, 1, vehicle.id, 6, 2, WreckResult.ARRACHEE, 2);
    event.execute(participants);
    event.undo(participants);
    expect(vehicle.chocs).toBe(before);
  });

  it('describe() résume la ligne, le tirage et les chocs gagnés', () => {
    const event = new WreckResolvedEvent(1, 10, 1, 1, 1, 4, 0, WreckResult.ROUE_CABOSSEE, 1);
    expect(event.describe()).toBe(
      'Table des Épaves : Passage de roue cabossé (D6=4+0 chocs, +1 choc(s))',
    );
  });

  it('describe() n\'ajoute pas de mention de chocs si chocsGained = 0', () => {
    const event = new WreckResolvedEvent(1, 10, 1, 1, 1, 2, 0, WreckResult.INDEMNE, 0);
    expect(event.describe()).toBe('Table des Épaves : S\'en sort indemne (D6=2+0 chocs)');
  });

  it('describe() affiche une perte de chocs négative (DEBOSSELE)', () => {
    const event = new WreckResolvedEvent(1, 10, 1, 1, 1, 1, 1, WreckResult.DEBOSSELE, -1);
    expect(event.describe()).toBe('Table des Épaves : Débosselé ! (D6=1+1 chocs, -1 choc(s))');
  });
});
