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

  it('execute avec wreckResult=FAVORI_DU_PUBLIC marque le véhicule', () => {
    const { participant, participants, vehicle } = makeTestParticipant();
    const event = new WreckResolvedEvent(1, 10, participant.id, 1, vehicle.id, 9, 0, WreckResult.FAVORI_DU_PUBLIC, 3);
    event.execute(participants);
    expect(vehicle.hasFavoriDuPublic).toBe(true);
  });

  it('execute avec un autre résultat ne touche pas hasFavoriDuPublic', () => {
    const { participant, participants, vehicle } = makeTestParticipant();
    const event = new WreckResolvedEvent(1, 10, participant.id, 1, vehicle.id, 3, 0, WreckResult.ROUE_CABOSSEE, 1);
    event.execute(participants);
    expect(vehicle.hasFavoriDuPublic).toBe(false);
  });

  it('undo annule le statut Favori du Public posé par ce tirage', () => {
    const { participant, participants, vehicle } = makeTestParticipant();
    const event = new WreckResolvedEvent(1, 10, participant.id, 1, vehicle.id, 9, 0, WreckResult.FAVORI_DU_PUBLIC, 3);
    event.execute(participants);
    event.undo(participants);
    expect(vehicle.hasFavoriDuPublic).toBe(false);
  });

  it('describe() résume le véhicule, la ligne, le tirage et les chocs gagnés', () => {
    const { participant, participants, vehicle } = makeTestParticipant();
    const event = new WreckResolvedEvent(1, 10, participant.id, 1, vehicle.id, 4, 0, WreckResult.ROUE_CABOSSEE, 1);
    expect(event.describe(participants)).toBe(
      'Table des Épaves (Voiture) : Passage de roue cabossé (D6=4+0 chocs, +1 choc(s))',
    );
  });

  it('describe() n\'ajoute pas de mention de chocs si chocsGained = 0', () => {
    const { participant, participants, vehicle } = makeTestParticipant();
    const event = new WreckResolvedEvent(1, 10, participant.id, 1, vehicle.id, 2, 0, WreckResult.INDEMNE, 0);
    expect(event.describe(participants)).toBe('Table des Épaves (Voiture) : S\'en sort indemne (D6=2+0 chocs)');
  });

  it('describe() affiche une perte de chocs négative (DEBOSSELE)', () => {
    const { participant, participants, vehicle } = makeTestParticipant();
    const event = new WreckResolvedEvent(1, 10, participant.id, 1, vehicle.id, 1, 1, WreckResult.DEBOSSELE, -1);
    expect(event.describe(participants)).toBe('Table des Épaves (Voiture) : Débosselé ! (D6=1+1 chocs, -1 choc(s))');
  });
});
