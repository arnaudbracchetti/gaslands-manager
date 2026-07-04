import { describe, it, expect } from 'vitest';
import { GameStatus } from '../enums/game-status.enum';
import { EvenementTeleGame } from './evenement-tele-game';
import { EscarmoucheGame } from './escarmouche-game';
import { AtelierGame } from './atelier-game';
import { RankingAssignedEvent } from '../events/ranking-assigned.event';
import { WalletMovementEvent } from '../events/wallet-movement.event';
import { EquipmentChangedEvent } from '../events/equipment-changed.event';
import { SequellaAddedEvent } from '../events/sequella-added.event';
import { GatesCrossedEvent } from '../events/gates-crossed.event';
import { VehicleDestroyedEvent } from '../events/vehicle-destroyed.event';
import { WalletReason } from '../enums/wallet-reason.enum';
import { WeightClass } from '../enums/weight-class.enum';

function makeRankingEvent(id = 1): RankingAssignedEvent {
  return new RankingAssignedEvent(id, 10, 1, id, 1, 5);
}

function makeWalletEvent(id = 2): WalletMovementEvent {
  return new WalletMovementEvent(id, 10, 1, id, 10, WalletReason.RECOMPENSE);
}

function makeEquipmentEvent(id = 3): EquipmentChangedEvent {
  return new EquipmentChangedEvent(id, 10, 1, id, 'BUY', 'WEAPON', 'mitrailleuse', 5, 1, null, null, null, null);
}

function makeSequellaEvent(id = 4): SequellaAddedEvent {
  return new SequellaAddedEvent(id, 10, 1, id, 1, 'moteur_endommage', 2);
}

function makeGatesCrossedEvent(id = 5): GatesCrossedEvent {
  return new GatesCrossedEvent(id, 10, 1, id, 3, 3);
}

function makeVehicleDestroyedEvent(id = 6): VehicleDestroyedEvent {
  return new VehicleDestroyedEvent(id, 10, 1, id, 2, WeightClass.LOURD, 3);
}

describe('EvenementTeleGame — canAccept', () => {
  const game = new EvenementTeleGame(10, 1, GameStatus.PLANIFIE, 1, 'scen_1', null, []);

  it('accepte RankingAssignedEvent', () => {
    expect(game.canAccept(makeRankingEvent())).toBe(true);
  });

  it('accepte WalletMovementEvent', () => {
    expect(game.canAccept(makeWalletEvent())).toBe(true);
  });

  it('refuse EquipmentChangedEvent', () => {
    expect(game.canAccept(makeEquipmentEvent())).toBe(false);
  });

  it('accepte SequellaAddedEvent', () => {
    expect(game.canAccept(makeSequellaEvent())).toBe(true);
  });

  it('accepte GatesCrossedEvent', () => {
    expect(game.canAccept(makeGatesCrossedEvent())).toBe(true);
  });

  it('accepte VehicleDestroyedEvent', () => {
    expect(game.canAccept(makeVehicleDestroyedEvent())).toBe(true);
  });

  it('type est EVENEMENT_TELE', () => {
    expect(game.type).toBe('EVENEMENT_TELE');
  });
});

describe('EscarmoucheGame — canAccept', () => {
  const game = new EscarmoucheGame(10, 1, GameStatus.PLANIFIE, 2, 'scen_2', null, []);

  it('accepte RankingAssignedEvent (contrainte PC=0 est write-time, pas ici)', () => {
    expect(game.canAccept(makeRankingEvent())).toBe(true);
  });

  it('refuse EquipmentChangedEvent', () => {
    expect(game.canAccept(makeEquipmentEvent())).toBe(false);
  });

  it('accepte GatesCrossedEvent', () => {
    expect(game.canAccept(makeGatesCrossedEvent())).toBe(true);
  });

  it('accepte VehicleDestroyedEvent', () => {
    expect(game.canAccept(makeVehicleDestroyedEvent())).toBe(true);
  });

  it('type est ESCARMOUCHE', () => {
    expect(game.type).toBe('ESCARMOUCHE');
  });
});

describe('AtelierGame — canAccept', () => {
  const game = new AtelierGame(10, 1, GameStatus.OUVERT, 1.5, []);

  it('accepte EquipmentChangedEvent', () => {
    expect(game.canAccept(makeEquipmentEvent())).toBe(true);
  });

  it('accepte SequellaAddedEvent', () => {
    expect(game.canAccept(makeSequellaEvent())).toBe(true);
  });

  it('refuse RankingAssignedEvent', () => {
    expect(game.canAccept(makeRankingEvent())).toBe(false);
  });

  it('refuse WalletMovementEvent', () => {
    expect(game.canAccept(makeWalletEvent())).toBe(false);
  });

  it('refuse GatesCrossedEvent', () => {
    expect(game.canAccept(makeGatesCrossedEvent())).toBe(false);
  });

  it('refuse VehicleDestroyedEvent', () => {
    expect(game.canAccept(makeVehicleDestroyedEvent())).toBe(false);
  });

  it('type est ATELIER', () => {
    expect(game.type).toBe('ATELIER');
  });
});

describe('Game — addEvent / DomainException', () => {
  it('lève si canAccept retourne false', () => {
    const atelier = new AtelierGame(10, 1, GameStatus.OUVERT, 1.5, []);
    const ranking = makeRankingEvent();
    expect(() => atelier.addEvent(ranking)).toThrow('pas autorisé');
  });

  it('refuse tout événement sur un atelier figé (CLOTURE)', () => {
    const atelier = new AtelierGame(10, 1, GameStatus.CLOTURE, 1.5, []);
    expect(() => atelier.addEvent(makeEquipmentEvent())).toThrow('figée');
  });

  it('refuse tout événement sur une partie déjà jouée (JOUE)', () => {
    const partie = new EvenementTeleGame(10, 1, GameStatus.JOUE, 1, 'scen', new Date(), []);
    expect(() => partie.addEvent(makeRankingEvent())).toThrow('figée');
  });

  it('markPlayed fige la partie (PLANIFIE → JOUE, horodatée)', () => {
    const partie = new EvenementTeleGame(10, 1, GameStatus.PLANIFIE, 1, 'scen', null, []);
    partie.markPlayed();
    expect(partie.status).toBe(GameStatus.JOUE);
    expect(partie.playedAt).toBeInstanceOf(Date);
    expect(() => partie.addEvent(makeRankingEvent())).toThrow('figée');
  });

  it('close fige l\'atelier (OUVERT → CLOTURE)', () => {
    const atelier = new AtelierGame(10, 1, GameStatus.OUVERT, 1.5, []);
    atelier.close();
    expect(atelier.status).toBe(GameStatus.CLOTURE);
    expect(() => atelier.addEvent(makeEquipmentEvent())).toThrow('figée');
  });

  it('_events triés par eventOrder dans apply', () => {
    const applied: number[] = [];
    class SpyEvent extends RankingAssignedEvent {
      override execute(): void { applied.push(this.eventOrder); }
      override undo(): void { }
    }
    const e1 = new SpyEvent(1, 10, 1, 3, 1, 0);
    const e2 = new SpyEvent(2, 10, 1, 1, 1, 0);
    const game = new EvenementTeleGame(10, 1, GameStatus.PLANIFIE, 1, 'scen', null, [e1, e2]);
    game.apply([]);
    expect(applied).toEqual([1, 3]);  // sorted by eventOrder
  });
});
