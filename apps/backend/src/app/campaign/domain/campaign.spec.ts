import { describe, it, expect } from 'vitest';
import { Campaign } from './campaign';
import { CampaignParticipant } from './campaign-participant';
import type { Game } from './games/game';
import { EvenementTeleGame } from './games/evenement-tele-game';
import { RankingAssignedEvent } from './events/ranking-assigned.event';
import { GameStatus } from './enums/game-status.enum';
import { CampaignState, ParticipantStatus } from './enums/campaign.enums';
import { makeTestParticipant } from './test-helpers';

/** Fabrique une campagne EN_CONSTRUCTION avec le nouveau constructeur unifié. */
function makeCampaign(
  participants: CampaignParticipant[],
  games: Game[],
  state: CampaignState = CampaignState.EN_CONSTRUCTION,
): Campaign {
  return new Campaign(1, 'Campagne Test', state, 'invite-code', participants, games);
}

function makeGame(id: number, order: number, events = [] as RankingAssignedEvent[]): EvenementTeleGame {
  return new EvenementTeleGame(id, 1, GameStatus.PLANIFIE, order, `scen_${id}`, null, events);
}

function makeRankingEvent(participantId: number, points: number, gameId: number, order = 1): RankingAssignedEvent {
  return new RankingAssignedEvent(order * 100 + participantId, gameId, participantId, order, 1, points);
}

describe('Campaign — findGame', () => {
  it('retourne la partie par id', () => {
    const { participant } = makeTestParticipant();
    const game = makeGame(1, 1);
    const campaign = makeCampaign([participant], [game]);
    expect(campaign.findGame(1)).toBe(game);
  });

  it('lève DomainException si la partie est introuvable', () => {
    const { participant } = makeTestParticipant();
    const campaign = makeCampaign([participant], []);
    expect(() => campaign.findGame(999)).toThrow('introuvable');
  });
});

describe('Campaign — findAtelierGame', () => {
  it('retourne l\'unique partie en ATELIER', () => {
    const { participant } = makeTestParticipant();
    const planifie = makeGame(10, 1);
    const atelier = new EvenementTeleGame(20, 1, GameStatus.ATELIER, 2, 'scen_20', new Date(), []);
    const campaign = makeCampaign([participant], [planifie, atelier]);
    expect(campaign.findAtelierGame()).toBe(atelier);
  });

  it('lève DomainException si aucun atelier n\'est ouvert', () => {
    const { participant } = makeTestParticipant();
    const game = makeGame(10, 1);
    const campaign = makeCampaign([participant], [game]);
    expect(() => campaign.findAtelierGame()).toThrow('atelier');
  });
});

describe('Campaign — replay', () => {
  it('replay complet réinitialise les compteurs avant d\'appliquer', () => {
    const { participant } = makeTestParticipant();
    const event1 = makeRankingEvent(participant.id, 5, 10);
    const game = makeGame(10, 1, [event1]);
    const campaign = makeCampaign([participant], [game]);

    campaign.replay();
    expect(participant.championshipPoints).toBe(5);
  });

  it('replay remet les compteurs à zéro avant de rejouer', () => {
    const { participant } = makeTestParticipant();
    const event1 = makeRankingEvent(participant.id, 5, 10);
    const game = makeGame(10, 1, [event1]);
    const campaign = makeCampaign([participant], [game]);

    campaign.replay();  // PC = 5
    campaign.replay();  // reset puis rejoue → PC = 5, pas 10
    expect(participant.championshipPoints).toBe(5);
  });

  it('replay de N parties dans l\'ordre d\'order', () => {
    const { participant } = makeTestParticipant();
    const e1 = makeRankingEvent(participant.id, 3, 20);
    const e2 = makeRankingEvent(participant.id, 7, 10);
    const game1 = makeGame(20, 2, [e1]);  // order=2
    const game2 = makeGame(10, 1, [e2]);  // order=1 — doit être joué en premier
    const campaign = makeCampaign([participant], [game1, game2]);

    campaign.replay();
    expect(participant.championshipPoints).toBe(10);  // 3 + 7
  });

  it('wallet initial = team.remainingBudget après reset', () => {
    const { participant } = makeTestParticipant();  // cans 50 − build 21 = 29
    const campaign = makeCampaign([participant], []);
    campaign.replay();
    expect(participant.wallet).toBe(29);
  });
});

describe('Campaign — replayUpTo', () => {
  it('rejoue seulement les parties dont order < target.order', () => {
    const { participant } = makeTestParticipant();
    const e1 = makeRankingEvent(participant.id, 4, 10);
    const e2 = makeRankingEvent(participant.id, 6, 20);
    const game1 = makeGame(10, 1, [e1]);  // order=1
    const game2 = makeGame(20, 2, [e2]);  // order=2
    const campaign = makeCampaign([participant], [game1, game2]);

    campaign.replayUpTo(20);  // rejoue uniquement game1
    expect(participant.championshipPoints).toBe(4);
  });

  it('lève si gameId cible est introuvable', () => {
    const { participant } = makeTestParticipant();
    const campaign = makeCampaign([participant], []);
    expect(() => campaign.replayUpTo(999)).toThrow('introuvable');
  });
});

describe('Campaign — standings', () => {
  it('trie par PC décroissants', () => {
    const { participant: p1 } = makeTestParticipant(1);
    const { participant: p2 } = makeTestParticipant(2);
    const e1 = makeRankingEvent(1, 10, 10);
    const e2 = makeRankingEvent(2, 15, 10);
    const game = new EvenementTeleGame(10, 1, GameStatus.PLANIFIE, 1, 'scen', null, [e1, e2]);
    const campaign = makeCampaign([p1, p2], [game]);
    campaign.replay();

    const standings = campaign.standings();
    expect(standings[0].participantId).toBe(2);   // p2 = 15 PC
    expect(standings[1].participantId).toBe(1);   // p1 = 10 PC
  });

  it('n\'expose pas resistancePoints dans le classement', () => {
    const { participant } = makeTestParticipant();
    const campaign = makeCampaign([participant], []);
    campaign.replay();

    for (const entry of campaign.standings()) {
      expect(entry).not.toHaveProperty('resistancePoints');
    }
  });
});

describe('Campaign — enterAtelier', () => {
  it('passe la partie à ATELIER et l\'horodate', () => {
    const { participant } = makeTestParticipant();
    const game = makeGame(10, 1);
    const campaign = makeCampaign([participant], [game]);

    const result = campaign.enterAtelier(10);

    expect(game.status).toBe(GameStatus.ATELIER);
    expect(game.playedAt).not.toBeNull();
    expect(result.autoClosedGameId).toBeNull();
  });

  it('clôt automatiquement une autre partie encore en ATELIER (avec avertissement)', () => {
    const { participant } = makeTestParticipant();
    const game1 = new EvenementTeleGame(10, 1, GameStatus.ATELIER, 1, 'scen_10', new Date(), []);
    const game2 = makeGame(20, 2);
    const campaign = makeCampaign([participant], [game1, game2]);

    const result = campaign.enterAtelier(20);

    expect(game1.status).toBe(GameStatus.JOUE);
    expect(game2.status).toBe(GameStatus.ATELIER);
    expect(result.autoClosedGameId).toBe(10);
  });

  it('lève si la partie n\'est pas PLANIFIE', () => {
    const { participant } = makeTestParticipant();
    const game = new EvenementTeleGame(10, 1, GameStatus.JOUE, 1, 'scen', new Date(), []);
    const campaign = makeCampaign([participant], [game]);

    expect(() => campaign.enterAtelier(10)).toThrow('PLANIFIE');
  });
});

describe('Campaign — closeAtelier', () => {
  it('clôture manuelle : ATELIER → JOUE', () => {
    const { participant } = makeTestParticipant();
    const game = new EvenementTeleGame(10, 1, GameStatus.ATELIER, 1, 'scen', new Date(), []);
    const campaign = makeCampaign([participant], [game]);

    campaign.closeAtelier(10);

    expect(game.status).toBe(GameStatus.JOUE);
  });

  it('lève si la partie n\'est pas en ATELIER', () => {
    const { participant } = makeTestParticipant();
    const game = makeGame(10, 1);
    const campaign = makeCampaign([participant], [game]);

    expect(() => campaign.closeAtelier(10)).toThrow('atelier');
  });
});

describe('Campaign — closeCampaign', () => {
  it('clôt toute partie encore en ATELIER', () => {
    const { participant } = makeTestParticipant();
    const game = new EvenementTeleGame(10, 1, GameStatus.ATELIER, 1, 'scen', new Date(), []);
    const campaign = makeCampaign([participant], [game]);

    campaign.closeCampaign();

    expect(game.status).toBe(GameStatus.JOUE);
  });

  it('ne touche pas aux parties déjà JOUE', () => {
    const { participant } = makeTestParticipant();
    const game = new EvenementTeleGame(10, 1, GameStatus.JOUE, 1, 'scen', new Date(), []);
    const campaign = makeCampaign([participant], [game]);

    campaign.closeCampaign();

    expect(game.status).toBe(GameStatus.JOUE);  // inchangé
  });
});

// ── Commandes CRUD (Phase 2 — basculement DDD) ─────────────────────────────────

describe('Campaign — requestJoin', () => {
  it('ajoute un participant PENDING', () => {
    const { participant } = makeTestParticipant();  // userId 42
    const campaign = makeCampaign([participant], []);

    const p = campaign.requestJoin(7, 3);

    expect(p.status).toBe(ParticipantStatus.PENDING);
    expect(p.userId).toBe(7);
    expect(campaign.participants).toContain(p);
  });

  it('refuse une seconde demande du même utilisateur', () => {
    const { participant } = makeTestParticipant();  // userId 42
    const campaign = makeCampaign([participant], []);
    expect(() => campaign.requestJoin(42, 3)).toThrow('déjà');
  });

  it('refuse une inscription hors EN_CONSTRUCTION', () => {
    const { participant } = makeTestParticipant();
    const campaign = makeCampaign([participant], [], CampaignState.EN_COURS);
    expect(() => campaign.requestJoin(7, 3)).toThrow();
  });
});

describe('Campaign — validateParticipant', () => {
  it('valide une demande PENDING', () => {
    const organizer = new CampaignParticipant(1, 42, 1, true, ParticipantStatus.VALIDATED);
    const pending = new CampaignParticipant(2, 7, 3, false, ParticipantStatus.PENDING);
    const campaign = makeCampaign([organizer, pending], []);

    campaign.validateParticipant(2, true);

    expect(pending.status).toBe(ParticipantStatus.VALIDATED);
  });

  it('empêche de refuser le dernier organisateur validé', () => {
    const organizer = new CampaignParticipant(1, 42, 1, true, ParticipantStatus.VALIDATED);
    const campaign = makeCampaign([organizer], []);
    expect(() => campaign.validateParticipant(1, false)).toThrow('dernier organisateur');
  });
});

describe('Campaign — promoteParticipant', () => {
  it('promeut un participant VALIDATED en organisateur', () => {
    const organizer = new CampaignParticipant(1, 42, 1, true, ParticipantStatus.VALIDATED);
    const member = new CampaignParticipant(2, 7, 3, false, ParticipantStatus.VALIDATED);
    const campaign = makeCampaign([organizer, member], []);

    campaign.promoteParticipant(2);

    expect(member.isOrganizer).toBe(true);
  });

  it('refuse la promotion d\'un participant non validé', () => {
    const organizer = new CampaignParticipant(1, 42, 1, true, ParticipantStatus.VALIDATED);
    const pending = new CampaignParticipant(2, 7, 3, false, ParticipantStatus.PENDING);
    const campaign = makeCampaign([organizer, pending], []);
    expect(() => campaign.promoteParticipant(2)).toThrow('validé');
  });
});

describe('Campaign — removeParticipant', () => {
  it('retire un participant et mémorise son id pour la persistance', () => {
    const organizer = new CampaignParticipant(1, 42, 1, true, ParticipantStatus.VALIDATED);
    const member = new CampaignParticipant(2, 7, 3, false, ParticipantStatus.VALIDATED);
    const campaign = makeCampaign([organizer, member], []);

    campaign.removeParticipant(2);

    expect(campaign.participants.find((p) => p.id === 2)).toBeUndefined();
    expect(campaign.removedParticipantIds).toContain(2);
  });

  it('empêche de retirer le dernier organisateur', () => {
    const organizer = new CampaignParticipant(1, 42, 1, true, ParticipantStatus.VALIDATED);
    const campaign = makeCampaign([organizer], []);
    expect(() => campaign.removeParticipant(1)).toThrow('dernier organisateur');
  });
});

describe('Campaign — changeParticipantTeam', () => {
  it('change l\'équipe engagée d\'un participant VALIDATED', () => {
    const member = new CampaignParticipant(2, 7, 3, false, ParticipantStatus.VALIDATED);
    const campaign = makeCampaign([member], []);

    campaign.changeParticipantTeam(7, 9);

    expect(member.teamId).toBe(9);
  });

  it('interdit le désengagement (null) à un non-organisateur', () => {
    const member = new CampaignParticipant(2, 7, 3, false, ParticipantStatus.VALIDATED);
    const campaign = makeCampaign([member], []);
    expect(() => campaign.changeParticipantTeam(7, null)).toThrow('organisateur');
  });
});

describe('Campaign — addGame / updateGame / removeGame', () => {
  it('ajoute une partie PLANIFIE en fin de programme (order MAX+1)', () => {
    const { participant } = makeTestParticipant();
    const g1 = makeGame(10, 1);
    const campaign = makeCampaign([participant], [g1]);

    const g = campaign.addGame('scen', 'EVENEMENT_TELE');

    expect(g.order).toBe(2);
    expect(g.status).toBe(GameStatus.PLANIFIE);
  });

  it('met à jour le scénario d\'une partie PLANIFIE en conservant id/order', () => {
    const { participant } = makeTestParticipant();
    const g1 = makeGame(10, 3);
    const campaign = makeCampaign([participant], [g1]);

    const updated = campaign.updateGame(10, 'nouveau_scen', 'ESCARMOUCHE');

    expect(updated.id).toBe(10);
    expect(updated.order).toBe(3);
    expect(updated.type).toBe('ESCARMOUCHE');
  });

  it('supprime une partie PLANIFIE et mémorise son id', () => {
    const { participant } = makeTestParticipant();
    const g1 = makeGame(10, 1);
    const campaign = makeCampaign([participant], [g1]);

    campaign.removeGame(10);

    expect(campaign.games.find((g) => g.id === 10)).toBeUndefined();
    expect(campaign.removedGameIds).toContain(10);
  });
});

