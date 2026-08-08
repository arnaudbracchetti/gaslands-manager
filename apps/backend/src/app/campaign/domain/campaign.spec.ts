import { describe, it, expect } from 'vitest';
import { Campaign } from './campaign';
import { CampaignParticipant } from './campaign-participant';
import type { Game } from './games/game';
import { EvenementTeleGame } from './games/evenement-tele-game';
import { RankingAssignedEvent } from './events/ranking-assigned.event';
import { GameStatus } from './enums/game-status.enum';
import { CampaignState, ParticipantStatus } from './enums/campaign.enums';
import { makeTestParticipant, makeTeam, makeTeamWithVehicles } from './test-helpers';

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

describe('Campaign - budget / assertTeamFitsBudget', () => {
  it('vaut 50 par défaut si non fourni au constructeur', () => {
    const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_CONSTRUCTION, 'invite-code', [], []);
    expect(campaign.budget).toBe(50);
  });

  it('retourne la valeur fournie au constructeur', () => {
    const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_CONSTRUCTION, 'invite-code', [], [], 20);
    expect(campaign.budget).toBe(20);
  });

  it('accepte une équipe dont le coût cumulé est exactement égal au budget', () => {
    const { vehicle } = makeTestParticipant();  // vehicle (+ arme + amélioration) de coût 21
    const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_CONSTRUCTION, 'invite-code', [], [], 21);
    expect(() => campaign.assertTeamFitsBudget(makeTeamWithVehicles(3, [vehicle]))).not.toThrow();
  });

  it('refuse une équipe dont le coût cumulé dépasse le budget d\'une seule unité', () => {
    const { vehicle } = makeTestParticipant();  // vehicle (+ arme + amélioration) de coût 21
    const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_CONSTRUCTION, 'invite-code', [], [], 20);
    expect(() => campaign.assertTeamFitsBudget(makeTeamWithVehicles(3, [vehicle]))).toThrow('au-delà du budget');
  });
});

describe('Campaign - modification (rename/changeBudget)', () => {
  it('rename() est refusé hors EN_CONSTRUCTION', () => {
    const campaign = makeCampaign([], [], CampaignState.EN_COURS);
    expect(() => campaign.rename('Nouveau nom')).toThrow('construction');
  });

  it('rename() modifie le nom en EN_CONSTRUCTION', () => {
    const campaign = makeCampaign([], []);
    campaign.rename('Nouveau nom');
    expect(campaign.name).toBe('Nouveau nom');
  });

  it('changeBudget() est refusé hors EN_CONSTRUCTION', () => {
    const campaign = makeCampaign([], [], CampaignState.EN_COURS);
    expect(() => campaign.changeBudget(30)).toThrow('construction');
  });

  it('changeBudget() accepte un budget exactement égal au coût de l\'équipe déjà engagée la plus chère', () => {
    const { participant } = makeTestParticipant();  // VALIDATED, équipe de coût 21
    const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_CONSTRUCTION, 'invite-code', [participant], [], 50);
    expect(() => campaign.changeBudget(21)).not.toThrow();
    expect(campaign.budget).toBe(21);
  });

  it('changeBudget() refuse un budget inférieur d\'une seule unité au coût de l\'équipe déjà engagée', () => {
    const { participant } = makeTestParticipant();  // VALIDATED, équipe de coût 21
    const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_CONSTRUCTION, 'invite-code', [participant], [], 50);
    expect(() => campaign.changeBudget(20)).toThrow('au-delà du budget');
    expect(campaign.budget).toBe(50);  // inchangé : la mutation n'a lieu qu'après validation complète
  });

  it('changeBudget() ignore les participants PENDING et REJECTED, même hors budget', () => {
    const { vehicle } = makeTestParticipant();  // véhicule de coût 21
    const pending = new CampaignParticipant(2, 43, 2, false, ParticipantStatus.PENDING);
    pending.attachTeam(makeTeamWithVehicles(2, [vehicle]));
    const rejected = new CampaignParticipant(3, 44, 3, false, ParticipantStatus.REJECTED);
    rejected.attachTeam(makeTeamWithVehicles(3, [vehicle]));

    const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_CONSTRUCTION, 'invite-code', [pending, rejected], [], 50);
    expect(() => campaign.changeBudget(10)).not.toThrow();
    expect(campaign.budget).toBe(10);
  });
});

// ── Commandes CRUD (Phase 2 — basculement DDD) ─────────────────────────────────

describe('Campaign — requestJoin', () => {
  it('ajoute un participant PENDING', () => {
    const { participant } = makeTestParticipant();  // userId 42
    const campaign = makeCampaign([participant], []);

    const p = campaign.requestJoin(7, makeTeam(3));

    expect(p.status).toBe(ParticipantStatus.PENDING);
    expect(p.userId).toBe(7);
    expect(campaign.participants).toContain(p);
  });

  it('refuse une seconde demande du même utilisateur', () => {
    const { participant } = makeTestParticipant();  // userId 42
    const campaign = makeCampaign([participant], []);
    expect(() => campaign.requestJoin(42, makeTeam(3))).toThrow('déjà');
  });

  it('refuse une inscription hors EN_CONSTRUCTION', () => {
    const { participant } = makeTestParticipant();
    const campaign = makeCampaign([participant], [], CampaignState.EN_COURS);
    expect(() => campaign.requestJoin(7, makeTeam(3))).toThrow();
  });

  it('refuse une équipe dont le coût dépasse le budget de la campagne', () => {
    const { participant, vehicle } = makeTestParticipant();  // vehicle de coût 12
    const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_CONSTRUCTION, 'invite-code', [participant], [], 20);
    const teamOverBudget = makeTeamWithVehicles(3, [vehicle, vehicle]);  // coût cumulé 24 > budget 20

    expect(() => campaign.requestJoin(7, teamOverBudget)).toThrow('au-delà du budget');
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

  it('refuse de valider un participant dont l\'équipe dépasse le budget de la campagne', () => {
    const { participant: organizer, vehicle } = makeTestParticipant();  // vehicle de coût 12
    const pending = new CampaignParticipant(2, 7, 3, false, ParticipantStatus.PENDING);
    pending.attachTeam(makeTeamWithVehicles(3, [vehicle, vehicle]));  // coût cumulé 24
    const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_CONSTRUCTION, 'invite-code', [organizer, pending], [], 20);

    expect(() => campaign.validateParticipant(2, true)).toThrow('au-delà du budget');
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

    campaign.changeParticipantTeam(7, makeTeam(9));

    expect(member.teamId).toBe(9);
  });

  it('interdit le désengagement (null) à un non-organisateur', () => {
    const member = new CampaignParticipant(2, 7, 3, false, ParticipantStatus.VALIDATED);
    const campaign = makeCampaign([member], []);
    expect(() => campaign.changeParticipantTeam(7, null)).toThrow('organisateur');
  });

  it('interdit de changer vers une AUTRE équipe si le participant a déjà des événements journalisés', () => {
    const member = new CampaignParticipant(2, 7, 3, false, ParticipantStatus.VALIDATED);
    const game = makeGame(10, 1, [makeRankingEvent(2, 10, 10)]);
    const campaign = makeCampaign([member], [game]);

    expect(() => campaign.changeParticipantTeam(7, makeTeam(9))).toThrow('événements journalisés');
    expect(member.teamId).toBe(3);
  });

  it('autorise de "changer" vers la MÊME équipe déjà engagée malgré un historique existant', () => {
    const member = new CampaignParticipant(2, 7, 3, false, ParticipantStatus.VALIDATED);
    const game = makeGame(10, 1, [makeRankingEvent(2, 10, 10)]);
    const campaign = makeCampaign([member], [game]);

    campaign.changeParticipantTeam(7, makeTeam(3));

    expect(member.teamId).toBe(3);
  });

  it('autorise le changement d\'équipe pour un participant SANS historique, même si d\'autres parties existent', () => {
    const member = new CampaignParticipant(2, 7, 3, false, ParticipantStatus.VALIDATED);
    const other = new CampaignParticipant(5, 99, 6, false, ParticipantStatus.VALIDATED);
    const game = makeGame(10, 1, [makeRankingEvent(5, 10, 10)]);
    const campaign = makeCampaign([member, other], [game]);

    campaign.changeParticipantTeam(7, makeTeam(9));

    expect(member.teamId).toBe(9);
  });

  it('refuse une nouvelle équipe dont le coût dépasse le budget de la campagne', () => {
    const { participant: organizer, vehicle } = makeTestParticipant();  // vehicle de coût 12
    const member = new CampaignParticipant(2, 7, 3, false, ParticipantStatus.VALIDATED);
    const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_CONSTRUCTION, 'invite-code', [organizer, member], [], 20);
    const teamOverBudget = makeTeamWithVehicles(9, [vehicle, vehicle]);  // coût cumulé 24 > budget 20

    expect(() => campaign.changeParticipantTeam(7, teamOverBudget)).toThrow('au-delà du budget');
    expect(member.teamId).toBe(3);
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

describe('Campaign — reorderGames', () => {
  it('réattribue les order des parties PLANIFIE selon le nouvel ordre demandé', () => {
    const { participant } = makeTestParticipant();
    const g1 = makeGame(10, 1);
    const g2 = makeGame(20, 2);
    const g3 = makeGame(30, 3);
    const campaign = makeCampaign([participant], [g1, g2, g3]);

    campaign.reorderGames([30, 10, 20]);

    expect(campaign.findGame(30).order).toBe(1);
    expect(campaign.findGame(10).order).toBe(2);
    expect(campaign.findGame(20).order).toBe(3);
  });

  it('ne touche jamais à l\'order d\'une partie ATELIER/JOUE, même intercalée', () => {
    const { participant } = makeTestParticipant();
    const planifieA = makeGame(10, 1);
    const joue = new EvenementTeleGame(20, 1, GameStatus.JOUE, 2, 'scen_20', new Date(), []);
    const planifieB = makeGame(30, 3);
    const campaign = makeCampaign([participant], [planifieA, joue, planifieB]);

    campaign.reorderGames([30, 10]);

    // Les 2 emplacements PLANIFIE (order 1 et 3) sont réattribués entre eux ;
    // la partie JOUE garde son order 2, intact.
    expect(campaign.findGame(30).order).toBe(1);
    expect(campaign.findGame(20).order).toBe(2);
    expect(campaign.findGame(10).order).toBe(3);
  });

  it('lève DomainException si un id fourni ne correspond pas à une partie PLANIFIE', () => {
    const { participant } = makeTestParticipant();
    const g1 = makeGame(10, 1);
    const joue = new EvenementTeleGame(20, 1, GameStatus.JOUE, 2, 'scen_20', new Date(), []);
    const campaign = makeCampaign([participant], [g1, joue]);

    expect(() => campaign.reorderGames([10, 20])).toThrow('planifiées');
  });

  it('lève DomainException si une partie PLANIFIE est absente de la liste fournie', () => {
    const { participant } = makeTestParticipant();
    const g1 = makeGame(10, 1);
    const g2 = makeGame(20, 2);
    const campaign = makeCampaign([participant], [g1, g2]);

    expect(() => campaign.reorderGames([10])).toThrow('planifiées');
  });

  it('lève DomainException si la campagne est TERMINEE', () => {
    const { participant } = makeTestParticipant();
    const g1 = makeGame(10, 1);
    const g2 = makeGame(20, 2);
    const campaign = makeCampaign([participant], [g1, g2], CampaignState.TERMINEE);

    expect(() => campaign.reorderGames([20, 10])).toThrow();
  });
});

