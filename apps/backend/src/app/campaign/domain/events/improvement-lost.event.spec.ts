import { describe, it, expect } from 'vitest';
import { ImprovementLostEvent } from './improvement-lost.event';
import { makeTestParticipant } from '../test-helpers';

describe('ImprovementLostEvent — execute / undo', () => {
  it('execute marque l\'amélioration comme perdue', () => {
    const { participant, participants, improvement } = makeTestParticipant();
    const event = new ImprovementLostEvent(1, 10, participant.id, 1, improvement.id);
    event.execute(participants);
    expect(improvement.isLost).toBe(true);
  });

  it('undo remet l\'amélioration active', () => {
    const { participant, participants, improvement } = makeTestParticipant();
    const event = new ImprovementLostEvent(1, 10, participant.id, 1, improvement.id);
    event.execute(participants);
    event.undo(participants);
    expect(improvement.isLost).toBe(false);
  });

  it('execute + undo → état identique', () => {
    const { participant, participants, improvement } = makeTestParticipant();
    const before = improvement.isLost;
    const event = new ImprovementLostEvent(1, 10, participant.id, 1, improvement.id);
    event.execute(participants);
    event.undo(participants);
    expect(improvement.isLost).toBe(before);
  });

  it('describe() décrit la perte de l\'amélioration, avec son nom et le véhicule hôte', () => {
    const { participant, participants, improvement } = makeTestParticipant();
    const event = new ImprovementLostEvent(1, 10, participant.id, 1, improvement.id);
    expect(event.describe(participants)).toBe('Amélioration perdue sur le véhicule Voiture : Blindage');
  });
});
