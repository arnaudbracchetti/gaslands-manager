import { describe, it, expect, beforeEach } from 'vitest';
import { Campaign } from './campaign';
import { CampaignParticipant } from './campaign-participant';
import { EvenementTeleGame } from './games/evenement-tele-game';
import { AtelierGame } from './games/atelier-game';
import { RankingAssignedEvent } from './events/ranking-assigned.event';
import { WalletMovementEvent } from './events/wallet-movement.event';
import { GameStatus } from './enums/game-status.enum';
import { WalletReason } from './enums/wallet-reason.enum';
import { makeTestParticipant } from './test-helpers';
import { DomainException } from '../../team/domain/vehicle';

function makeGame(id: number, order: number, events = [] as RankingAssignedEvent[]): EvenementTeleGame {
  return new EvenementTeleGame(id, 1, GameStatus.PLANIFIE, order, `scen_${id}`, null, events);
}

function makeRankingEvent(participantId: number, points: number, gameId: number, order = 1): RankingAssignedEvent {
  return new RankingAssignedEvent(order * 100 + participantId, gameId, participantId, order, 1, points);
}

function makeWalletEvent(participantId: number, amount: number, gameId: number): WalletMovementEvent {
  return new WalletMovementEvent(999, gameId, participantId, 2, amount, WalletReason.RECOMPENSE);
}

describe('Campaign — findGame', () => {
  it('retourne la partie par id', () => {
    const { participant } = makeTestParticipant();
    const game = makeGame(1, 1);
    const season = new Campaign(1, [participant], [game]);
    expect(season.findGame(1)).toBe(game);
  });

  it('lève DomainException si la partie est introuvable', () => {
    const { participant } = makeTestParticipant();
    const season = new Campaign(1, [participant], []);
    expect(() => season.findGame(999)).toThrow('introuvable');
  });
});

describe('Campaign — replay', () => {
  it('replay complet réinitialise les compteurs avant d\'appliquer', () => {
    const { participant, participants } = makeTestParticipant();
    const event1 = makeRankingEvent(participant.id, 5, 10);
    const game = makeGame(10, 1, [event1]);
    const season = new Campaign(1, [participant], [game]);

    season.replay();
    expect(participant.championshipPoints).toBe(5);
  });

  it('replay remet les compteurs à zéro avant de rejouer', () => {
    const { participant, participants } = makeTestParticipant();
    const event1 = makeRankingEvent(participant.id, 5, 10);
    const game = makeGame(10, 1, [event1]);
    const season = new Campaign(1, [participant], [game]);

    season.replay();  // PC = 5
    season.replay();  // reset puis rejoue → PC = 5, pas 10
    expect(participant.championshipPoints).toBe(5);
  });

  it('replay de N parties dans l\'ordre d\'order', () => {
    const { participant } = makeTestParticipant();
    const e1 = makeRankingEvent(participant.id, 3, 20);
    const e2 = makeRankingEvent(participant.id, 7, 10);
    const game1 = makeGame(20, 2, [e1]);  // order=2
    const game2 = makeGame(10, 1, [e2]);  // order=1 — doit être joué en premier
    const season = new Campaign(1, [participant], [game1, game2]);

    season.replay();
    // Les deux événements cumulent : 3 + 7 = 10
    expect(participant.championshipPoints).toBe(10);
  });

  it('wallet initial = team.cans après reset', () => {
    const { participant } = makeTestParticipant();  // team.cans = 50
    const season = new Campaign(1, [participant], []);
    season.replay();
    expect(participant.wallet).toBe(50);
  });
});

describe('Campaign — replayUpTo', () => {
  it('rejoue seulement les parties dont order < target.order', () => {
    const { participant } = makeTestParticipant();
    const e1 = makeRankingEvent(participant.id, 4, 10);
    const e2 = makeRankingEvent(participant.id, 6, 20);
    const game1 = makeGame(10, 1, [e1]);  // order=1
    const game2 = makeGame(20, 2, [e2]);  // order=2
    const season = new Campaign(1, [participant], [game1, game2]);

    season.replayUpTo(20);  // rejoue uniquement game1
    expect(participant.championshipPoints).toBe(4);
  });

  it('lève si gameId cible est introuvable', () => {
    const { participant } = makeTestParticipant();
    const season = new Campaign(1, [participant], []);
    expect(() => season.replayUpTo(999)).toThrow('introuvable');
  });
});

describe('Campaign — standings', () => {
  it('trie par PC décroissants', () => {
    const { participant: p1 } = makeTestParticipant(1);
    const { participant: p2 } = makeTestParticipant(2);
    const e1 = makeRankingEvent(1, 10, 10);
    const e2 = makeRankingEvent(2, 15, 10);
    const game = new EvenementTeleGame(10, 1, GameStatus.PLANIFIE, 1, 'scen', null, [e1, e2]);
    const season = new Campaign(1, [p1, p2], [game]);
    season.replay();

    const standings = season.standings();
    expect(standings[0].participantId).toBe(2);   // p2 = 15 PC
    expect(standings[1].participantId).toBe(1);   // p1 = 10 PC
  });

  it('n\'expose pas resistancePoints dans le classement', () => {
    const { participant } = makeTestParticipant();
    const season = new Campaign(1, [participant], []);
    season.replay();

    const standings = season.standings();
    for (const entry of standings) {
      expect(entry).not.toHaveProperty('resistancePoints');
    }
  });
});

describe('Campaign — finalizeGame', () => {
  it('passe la partie à JOUE et crée un AtelierGame OUVERT', () => {
    const { participant } = makeTestParticipant();
    const game = makeGame(10, 1);
    const season = new Campaign(1, [participant], [game]);

    const atelier = season.finalizeGame(10);

    expect(game.status).toBe(GameStatus.JOUE);
    expect(game.playedAt).not.toBeNull();
    expect(atelier.status).toBe(GameStatus.OUVERT);
    expect(atelier.type).toBe('ATELIER');
  });

  it('l\'atelier créé a order = game.order + 0.5', () => {
    const { participant } = makeTestParticipant();
    const game = makeGame(10, 2);
    const season = new Campaign(1, [participant], [game]);

    const atelier = season.finalizeGame(10);
    expect(atelier.order).toBe(2.5);
  });

  it('clôt l\'atelier OUVERT précédent s\'il existe', () => {
    const { participant } = makeTestParticipant();
    const game1 = makeGame(10, 1);
    const openAtelier = new AtelierGame(5, 1, GameStatus.OUVERT, 0.5, []);
    const game2 = makeGame(20, 2);
    const season = new Campaign(1, [participant], [game1, openAtelier, game2]);

    season.finalizeGame(20);

    expect(openAtelier.status).toBe(GameStatus.CLOTURE);
  });

  it('lève si la partie n\'est pas PLANIFIE', () => {
    const { participant } = makeTestParticipant();
    const game = new EvenementTeleGame(10, 1, GameStatus.JOUE, 1, 'scen', new Date(), []);
    const season = new Campaign(1, [participant], [game]);

    expect(() => season.finalizeGame(10)).toThrow('PLANIFIE');
  });
});

describe('Campaign — closeSeason', () => {
  it('clôt tous les ateliers OUVERT restants', () => {
    const { participant } = makeTestParticipant();
    const atelier = new AtelierGame(5, 1, GameStatus.OUVERT, 1.5, []);
    const season = new Campaign(1, [participant], [atelier]);

    season.closeSeason();

    expect(atelier.status).toBe(GameStatus.CLOTURE);
  });

  it('ne touche pas aux ateliers déjà CLOTURE', () => {
    const { participant } = makeTestParticipant();
    const atelier = new AtelierGame(5, 1, GameStatus.CLOTURE, 0.5, []);
    const season = new Campaign(1, [participant], [atelier]);

    season.closeSeason();

    expect(atelier.status).toBe(GameStatus.CLOTURE);  // inchangé
  });
});
