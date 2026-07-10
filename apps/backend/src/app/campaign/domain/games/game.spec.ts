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
import { ResistanceContactedEvent } from '../events/resistance-contacted.event';
import { WeaponLostEvent } from '../events/weapon-lost.event';
import { WreckResolvedEvent } from '../events/wreck-resolved.event';
import { WalletReason } from '../enums/wallet-reason.enum';
import { WeightClass } from '../enums/weight-class.enum';
import { WreckResult } from '../enums/wreck-result.enum';
import { WreckOutcome } from '../wreck/wreck-outcome';
import { WreckTable, type WreckTableResult } from '../wreck/wreck-table';
import { EquipmentOperation, EquipmentEntityType } from '../enums/equipment-change.enums';
import { CampaignParticipant } from '../campaign-participant';
import { ParticipantStatus } from '../enums/campaign.enums';
import { makeTestParticipant, makeVehicleType } from '../test-helpers';
import { Team } from '../../../team/domain/team';
import { Vehicle } from '../../../team/domain/vehicle';

/** Stub de WreckTable qui retourne un outcome et des événements pré-construits.
 * Isole Game.resolveWreck() de la logique de WreckTable (testée dans wreck-table.spec.ts). */
class FixedWreckTable extends WreckTable {
  constructor(
    private readonly fixedOutcome: WreckOutcome,
    private readonly fixedEvents: WreckTableResult['events'],
  ) {
    super({ roll: (): number => 1, pick: <T>(pool: T[]): T => pool[0] });
  }
  override resolve(
    _v: Parameters<WreckTable['resolve']>[0],
    _gameId: number,
    _participantId: number,
  ): WreckTableResult {
    return { outcome: this.fixedOutcome, events: this.fixedEvents };
  }
}

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

describe('Game — journal', () => {
  it('retourne les événements dans l\'ordre chronologique avec leur description', () => {
    const e1 = new RankingAssignedEvent(100, 10, 1, 1, 1, 10);
    const e2 = new GatesCrossedEvent(200, 10, 1, 2, 3, 3);
    const game = new EvenementTeleGame(10, 1, GameStatus.PLANIFIE, 1, 'scen', null, [e2, e1]); // volontairement désordonné en entrée

    const journal = game.journal();

    expect(journal.map((j) => j.eventId)).toEqual([e1.id, e2.id]); // trié par eventOrder
    expect(journal[0].participantId).toBe(1);
    expect(journal[0].description).toContain('Classé');
    expect(journal[1].description).toContain('porte');
  });

  it('inclut tous les types d\'événements, y compris ResistanceContactedEvent', () => {
    const resistanceEvent = new ResistanceContactedEvent(300, 10, 1, 1);
    const game = new EvenementTeleGame(10, 1, GameStatus.PLANIFIE, 1, 'scen', null, [resistanceEvent]);

    const journal = game.journal();

    expect(journal).toHaveLength(1);
    expect(journal[0].eventId).toBe(300);
  });
});

describe('Game — recordResult', () => {
  it('crée un RankingAssignedEvent par participant sans finaliser la partie', () => {
    const p1 = new CampaignParticipant(1, 42, 1, true, ParticipantStatus.VALIDATED);
    const p2 = new CampaignParticipant(2, 7, 3, false, ParticipantStatus.VALIDATED);
    const game = new EvenementTeleGame(10, 1, GameStatus.PLANIFIE, 1, 'scen', null, []);

    const events = game.recordResult([
      { participantId: 1, rank: 1 },
      { participantId: 2, rank: 2 },
    ], [p1, p2]);

    // 2 RankingAssignedEvent + 1 ResistanceContactedEvent automatique (p2 non classé).
    expect(events).toHaveLength(3);
    // La partie reste PLANIFIE — la finalisation (JOUE + atelier) n'a lieu qu'à la
    // fin complète du wizard, via un appel explicite à enterAtelier().
    expect(game.status).toBe(GameStatus.PLANIFIE);
    // EVENEMENT_TELE, classified = ceil(2/2) = 1 → rang 1 = 10 PC, rang 2 = 0.
    const rankingEvents = events.filter((e) => e instanceof RankingAssignedEvent) as RankingAssignedEvent[];
    expect(rankingEvents.find((e) => e.participantId === 1)?.championshipPoints).toBe(10);
    expect(rankingEvents.find((e) => e.participantId === 2)?.championshipPoints).toBe(0);
  });

  it('crédite automatiquement +3 PR au participant non classé, même sans exploit', () => {
    const p1 = new CampaignParticipant(1, 42, 1, true, ParticipantStatus.VALIDATED);
    const p2 = new CampaignParticipant(2, 7, 3, false, ParticipantStatus.VALIDATED);
    const game = new EvenementTeleGame(10, 1, GameStatus.PLANIFIE, 1, 'scen', null, []);

    const events = game.recordResult([
      { participantId: 1, rank: 1 },
      { participantId: 2, rank: 2 },
    ], [p1, p2]);

    const resistanceEvents = events.filter((e) => e instanceof ResistanceContactedEvent);
    expect(resistanceEvents).toHaveLength(1);
    expect(resistanceEvents[0].participantId).toBe(2);
  });

  it('ne crédite aucune PR automatique quand tout le monde est classé', () => {
    const p1 = new CampaignParticipant(1, 42, 1, true, ParticipantStatus.VALIDATED);
    const game = new EvenementTeleGame(10, 1, GameStatus.PLANIFIE, 1, 'scen', null, []);

    const events = game.recordResult([{ participantId: 1, rank: 1 }], [p1]);

    expect(events.some((e) => e instanceof ResistanceContactedEvent)).toBe(false);
  });

  it('refuse des rangs non consécutifs', () => {
    const p1 = new CampaignParticipant(1, 42, 1, true, ParticipantStatus.VALIDATED);
    const game = new EvenementTeleGame(10, 1, GameStatus.PLANIFIE, 1, 'scen', null, []);
    expect(() => game.recordResult([{ participantId: 1, rank: 2 }], [p1])).toThrow('consécutifs');
  });

  it('refuse un participant non validé', () => {
    const p1 = new CampaignParticipant(1, 42, 1, true, ParticipantStatus.VALIDATED);
    const game = new EvenementTeleGame(10, 1, GameStatus.PLANIFIE, 1, 'scen', null, []);
    expect(() => game.recordResult([{ participantId: 99, rank: 1 }], [p1])).toThrow();
  });

  it('refuse si la partie a déjà été jouée', () => {
    const p1 = new CampaignParticipant(1, 42, 1, true, ParticipantStatus.VALIDATED);
    const game = new EvenementTeleGame(10, 1, GameStatus.ATELIER, 1, 'scen', new Date(), []);
    expect(() => game.recordResult([{ participantId: 1, rank: 1 }], [p1])).toThrow('déjà été jouée');
  });

  it('crée un GatesCrossedEvent quand gatesCrossed > 0 (+1 PC par porte)', () => {
    const p1 = new CampaignParticipant(1, 42, 1, true, ParticipantStatus.VALIDATED);
    const game = new EvenementTeleGame(10, 1, GameStatus.PLANIFIE, 1, 'scen', null, []);

    const events = game.recordResult([{ participantId: 1, rank: 1, gatesCrossed: 3 }], [p1]);

    const gatesEvent = events.find((e) => e instanceof GatesCrossedEvent) as GatesCrossedEvent;
    expect(gatesEvent).toBeDefined();
    expect(gatesEvent.gatesCrossed).toBe(3);
    expect(gatesEvent.championshipPoints).toBe(3);
  });

  it('ignore gatesCrossed=0 ou absent (aucun GatesCrossedEvent créé)', () => {
    const p1 = new CampaignParticipant(1, 42, 1, true, ParticipantStatus.VALIDATED);
    const game = new EvenementTeleGame(10, 1, GameStatus.PLANIFIE, 1, 'scen', null, []);

    const events = game.recordResult([{ participantId: 1, rank: 1, gatesCrossed: 0 }], [p1]);

    expect(events.some((e) => e instanceof GatesCrossedEvent)).toBe(false);
  });

  it('crée un VehicleDestroyedEvent par véhicule ennemi détruit, PC dérivés du poids réel du véhicule', () => {
    const p1 = new CampaignParticipant(1, 42, 1, true, ParticipantStatus.VALIDATED);
    const p2 = new CampaignParticipant(2, 7, 3, false, ParticipantStatus.VALIDATED);
    const legerVehicle = new Vehicle(55, 3, makeVehicleType('Léger'), [], []);
    const lourdVehicle = new Vehicle(56, 3, makeVehicleType('Lourd'), [], []);
    const team = new Team(3, 7, 'Les Ennemis', 'Rutherford', 50, null, [legerVehicle, lourdVehicle]);
    p2.attachTeam(team);
    const game = new EvenementTeleGame(10, 1, GameStatus.PLANIFIE, 1, 'scen', null, []);

    // weightClass n'est PAS fourni par l'appelant (cf. DestroyedVehicleInput) — dérivé
    // par Game.recordResult depuis l'équipe réelle de p2, pas depuis le client.
    const events = game.recordResult([
      {
        participantId: 1,
        rank: 1,
        destroyedVehicles: [{ vehicleId: 55 }, { vehicleId: 56 }],
      },
      { participantId: 2, rank: 2 },
    ], [p1, p2]);

    const destroyedEvents = events.filter((e) => e instanceof VehicleDestroyedEvent) as VehicleDestroyedEvent[];
    expect(destroyedEvents).toHaveLength(2);
    // Le destructeur (participant 1) est crédité, pas le propriétaire du véhicule détruit.
    expect(destroyedEvents.every((e) => e.participantId === 1)).toBe(true);
    expect(destroyedEvents.find((e) => e.vehicleId === 55)?.championshipPoints).toBe(1);   // Léger
    expect(destroyedEvents.find((e) => e.vehicleId === 56)?.championshipPoints).toBe(3);   // Lourd
  });

  it('rejette un vehicleId de destroyedVehicles introuvable dans aucune équipe (empêche de forger des PC)', () => {
    const p1 = new CampaignParticipant(1, 42, 1, true, ParticipantStatus.VALIDATED);
    const game = new EvenementTeleGame(10, 1, GameStatus.PLANIFIE, 1, 'scen', null, []);

    expect(() =>
      game.recordResult([
        { participantId: 1, rank: 1, destroyedVehicles: [{ vehicleId: 999 }] },
      ], [p1]),
    ).toThrow('introuvable');
  });
});

describe('Game — resolveWreck', () => {
  it('passe les événements de WreckTable à la partie et les retourne', () => {
    const { participant, vehicle } = makeTestParticipant();
    const game = new EvenementTeleGame(10, 1, GameStatus.PLANIFIE, 1, 'scen', null, []);
    const outcome = new WreckOutcome(vehicle.id, 2, 0, WreckResult.INDEMNE, 0, null);
    const wreckEvent = new WreckResolvedEvent(0, 10, participant.id, 0, vehicle.id, 2, 0, WreckResult.INDEMNE, 0);
    const weaponEvent = new WeaponLostEvent(0, 10, participant.id, 0, 10);

    const result = game.resolveWreck(participant, vehicle.id, new FixedWreckTable(outcome, [wreckEvent, weaponEvent]));

    expect(result.outcome).toBe(outcome);
    expect(result.events).toHaveLength(2);
    expect(result.events[0]).toBe(wreckEvent);
    expect(result.events[1]).toBe(weaponEvent);
    expect(game.events).toHaveLength(2);
  });

  it('lève DomainException si le véhicule est introuvable dans l\'équipe', () => {
    const { participant } = makeTestParticipant();
    const game = new EvenementTeleGame(10, 1, GameStatus.PLANIFIE, 1, 'scen', null, []);
    const outcome = new WreckOutcome(999, 2, 0, WreckResult.INDEMNE, 0, null);

    expect(() => game.resolveWreck(participant, 999, new FixedWreckTable(outcome, [])))
      .toThrow('introuvable');
  });
});

describe('Game — creditFavoriDuPublicBonus', () => {
  it('crédite +5 PC quand le véhicule vient d\'être détruit', () => {
    const { vehicle } = makeTestParticipant();
    const game = new EvenementTeleGame(10, 1, GameStatus.PLANIFIE, 1, 'scen', null, []);

    const bonus = game.creditFavoriDuPublicBonus(1, vehicle.id, true);

    expect(bonus).toBeInstanceOf(FavoriDuPublicBonusEvent);
    expect((bonus as FavoriDuPublicBonusEvent).championshipPoints).toBe(5);
  });

  it('ne crédite rien si le véhicule n\'a pas été détruit — règle indépendante du tirage', () => {
    const { vehicle } = makeTestParticipant();
    const game = new EvenementTeleGame(10, 1, GameStatus.PLANIFIE, 1, 'scen', null, []);

    const bonus = game.creditFavoriDuPublicBonus(1, vehicle.id, false);

    expect(bonus).toBeNull();
  });
});

describe('Game — changeEquipment', () => {
  it('BUY : calcule le coût depuis le catalogue et débite la cagnotte (garde assertCanAfford)', () => {
    const { participant } = makeTestParticipant();  // wallet = 50
    const game = new EvenementTeleGame(10, 1, GameStatus.ATELIER, 1, 'scen', new Date(), []);

    const events = game.changeEquipment(participant, {
      operation: EquipmentOperation.BUY, entityType: EquipmentEntityType.VEHICLE, nomInterne: 'voiture',
      resolvedVehicleType: makeVehicleType(), resolvedWeaponType: null, resolvedImprovementType: null,
    });

    const event = events[0] as EquipmentChangedEvent;
    expect(event.cost).toBe(12);  // prix catalogue de makeVehicleType()
  });

  it('BUY : refuse si la cagnotte est insuffisante', () => {
    const { participant } = makeTestParticipant();
    participant.creditWallet(-45);  // wallet = 5, véhicule coûte 12
    const game = new EvenementTeleGame(10, 1, GameStatus.ATELIER, 1, 'scen', new Date(), []);

    expect(() => game.changeEquipment(participant, {
      operation: EquipmentOperation.BUY, entityType: EquipmentEntityType.VEHICLE, nomInterne: 'voiture',
      resolvedVehicleType: makeVehicleType(), resolvedWeaponType: null, resolvedImprovementType: null,
    })).toThrow('Cagnotte insuffisante');
  });

  it('BUY : refuse un nomInterne inconnu du catalogue', () => {
    const { participant } = makeTestParticipant();
    const game = new EvenementTeleGame(10, 1, GameStatus.ATELIER, 1, 'scen', new Date(), []);

    expect(() => game.changeEquipment(participant, {
      operation: EquipmentOperation.BUY, entityType: EquipmentEntityType.WEAPON, nomInterne: 'inconnue',
      resolvedVehicleType: null, resolvedWeaponType: null, resolvedImprovementType: null,
    })).toThrow('inconnu');
  });

  it('SELL : calcule le coût depuis l\'arme existante du véhicule', () => {
    const { participant, vehicle, weapon } = makeTestParticipant();
    const game = new EvenementTeleGame(10, 1, GameStatus.ATELIER, 1, 'scen', new Date(), []);

    const events = game.changeEquipment(participant, {
      operation: EquipmentOperation.SELL, entityType: EquipmentEntityType.WEAPON, nomInterne: 'mitrailleuse',
      targetVehicleId: vehicle.id, targetEntityId: weapon.id,
      resolvedVehicleType: null, resolvedWeaponType: null, resolvedImprovementType: null,
    });

    expect((events[0] as EquipmentChangedEvent).cost).toBe(5);  // prix catalogue de makeWeaponType()
  });

  it('SELL : dérive le nomInterne + le type de l\'entité vendue (même si le client ne les transmet pas)', () => {
    // Régression : le frontend envoie nomInterne="" pour un SELL. Sans dérivation,
    // l'événement persisté portait "" → le mapper de replay échouait ("Arme catalogue
    // introuvable"). L'agrégat doit donc renseigner le nomInterne depuis l'arme vendue.
    const { participant, vehicle, weapon } = makeTestParticipant();
    const game = new EvenementTeleGame(10, 1, GameStatus.ATELIER, 1, 'scen', new Date(), []);

    const events = game.changeEquipment(participant, {
      operation: EquipmentOperation.SELL, entityType: EquipmentEntityType.WEAPON, nomInterne: '',
      targetVehicleId: vehicle.id, targetEntityId: weapon.id,
      resolvedVehicleType: null, resolvedWeaponType: null, resolvedImprovementType: null,
    });

    const event = events[0] as EquipmentChangedEvent;
    expect(event.nomInterne).toBe('mitrailleuse');
    expect(event.cost).toBe(5);
  });

  it('SELL : refuse une arme introuvable sur le véhicule visé', () => {
    const { participant, vehicle } = makeTestParticipant();
    const game = new EvenementTeleGame(10, 1, GameStatus.ATELIER, 1, 'scen', new Date(), []);

    expect(() => game.changeEquipment(participant, {
      operation: EquipmentOperation.SELL, entityType: EquipmentEntityType.WEAPON, nomInterne: 'mitrailleuse',
      targetVehicleId: vehicle.id, targetEntityId: 999,
      resolvedVehicleType: null, resolvedWeaponType: null, resolvedImprovementType: null,
    })).toThrow('introuvable');
  });
});
