import { describe, it, expect } from 'vitest';
import { GameStatus } from '../enums/game-status.enum';
import { EvenementTeleGame } from './evenement-tele-game';
import { EscarmoucheGame } from './escarmouche-game';
import { RankingAssignedEvent } from '../events/ranking-assigned.event';
import { WalletMovementEvent } from '../events/wallet-movement.event';
import { EquipmentChangedEvent } from '../events/equipment-changed.event';
import { SequellaAddedEvent } from '../events/sequella-added.event';
import { GatesCrossedEvent } from '../events/gates-crossed.event';
import { VehicleDestroyedEvent } from '../events/vehicle-destroyed.event';
import { ImprovementLostEvent } from '../events/improvement-lost.event';
import { FavoriDuPublicBonusEvent } from '../events/favori-du-public-bonus.event';
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

function makeImprovementLostEvent(id = 7): ImprovementLostEvent {
  return new ImprovementLostEvent(id, 10, 1, id, 2);
}

function makeFavoriDuPublicBonusEvent(id = 8): FavoriDuPublicBonusEvent {
  return new FavoriDuPublicBonusEvent(id, 10, 1, id, 2, 5);
}

describe('EvenementTeleGame — canAccept en PLANIFIE', () => {
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

  it('accepte SequellaAddedEvent (séquelle imposée par la Table des Épaves)', () => {
    expect(game.canAccept(makeSequellaEvent())).toBe(true);
  });

  it('accepte GatesCrossedEvent', () => {
    expect(game.canAccept(makeGatesCrossedEvent())).toBe(true);
  });

  it('accepte VehicleDestroyedEvent', () => {
    expect(game.canAccept(makeVehicleDestroyedEvent())).toBe(true);
  });

  it('accepte ImprovementLostEvent', () => {
    expect(game.canAccept(makeImprovementLostEvent())).toBe(true);
  });

  it('accepte FavoriDuPublicBonusEvent', () => {
    expect(game.canAccept(makeFavoriDuPublicBonusEvent())).toBe(true);
  });

  it('type est EVENEMENT_TELE', () => {
    expect(game.type).toBe('EVENEMENT_TELE');
  });
});

describe('EvenementTeleGame — canAccept en ATELIER', () => {
  const game = new EvenementTeleGame(10, 1, GameStatus.ATELIER, 1, 'scen_1', new Date(), []);

  it('accepte EquipmentChangedEvent', () => {
    expect(game.canAccept(makeEquipmentEvent())).toBe(true);
  });

  it('accepte SequellaAddedEvent', () => {
    expect(game.canAccept(makeSequellaEvent())).toBe(true);
  });

  it('refuse RankingAssignedEvent', () => {
    expect(game.canAccept(makeRankingEvent())).toBe(false);
  });

  it('refuse GatesCrossedEvent', () => {
    expect(game.canAccept(makeGatesCrossedEvent())).toBe(false);
  });
});

describe('EscarmoucheGame — canAccept en PLANIFIE', () => {
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

  it('accepte ImprovementLostEvent', () => {
    expect(game.canAccept(makeImprovementLostEvent())).toBe(true);
  });

  it('accepte FavoriDuPublicBonusEvent', () => {
    expect(game.canAccept(makeFavoriDuPublicBonusEvent())).toBe(true);
  });

  it('type est ESCARMOUCHE', () => {
    expect(game.type).toBe('ESCARMOUCHE');
  });
});

describe('Game — addEvent / DomainException', () => {
  it('lève si canAccept retourne false', () => {
    const atelier = new EvenementTeleGame(10, 1, GameStatus.ATELIER, 1, 'scen', new Date(), []);
    const ranking = makeRankingEvent();
    expect(() => atelier.addEvent(ranking)).toThrow('pas autorisé');
  });

  it('refuse tout événement sur une partie figée (JOUE)', () => {
    const partie = new EvenementTeleGame(10, 1, GameStatus.JOUE, 1, 'scen', new Date(), []);
    expect(() => partie.addEvent(makeRankingEvent())).toThrow('figée');
    expect(() => partie.addEvent(makeEquipmentEvent())).toThrow('figée');
  });

  it('enterAtelier fait passer PLANIFIE → ATELIER, horodate', () => {
    const partie = new EvenementTeleGame(10, 1, GameStatus.PLANIFIE, 1, 'scen', null, []);
    partie.enterAtelier();
    expect(partie.status).toBe(GameStatus.ATELIER);
    expect(partie.playedAt).toBeInstanceOf(Date);
    expect(() => partie.addEvent(makeRankingEvent())).toThrow('pas autorisé');
    expect(partie.canAccept(makeEquipmentEvent())).toBe(true);
  });

  it('enterAtelier refuse si la partie n\'est pas PLANIFIE', () => {
    const partie = new EvenementTeleGame(10, 1, GameStatus.ATELIER, 1, 'scen', new Date(), []);
    expect(() => partie.enterAtelier()).toThrow('PLANIFIE');
  });

  it('closeAtelier fige la partie (ATELIER → JOUE)', () => {
    const partie = new EvenementTeleGame(10, 1, GameStatus.ATELIER, 1, 'scen', new Date(), []);
    partie.closeAtelier();
    expect(partie.status).toBe(GameStatus.JOUE);
    expect(() => partie.addEvent(makeEquipmentEvent())).toThrow('figée');
  });

  it('closeAtelier refuse si la partie n\'est pas en ATELIER', () => {
    const partie = new EvenementTeleGame(10, 1, GameStatus.PLANIFIE, 1, 'scen', null, []);
    expect(() => partie.closeAtelier()).toThrow('atelier');
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
