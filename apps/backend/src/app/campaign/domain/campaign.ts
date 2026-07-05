import { DomainException } from '../../shared/domain/domain-exception';
import { CampaignParticipant } from './campaign-participant';
import type { Game } from './games/game';
import type { GameEvent } from './events/game-event';
import { GameStatus } from './enums/game-status.enum';
import { AtelierGame } from './games/atelier-game';
import { EvenementTeleGame } from './games/evenement-tele-game';
import { EscarmoucheGame } from './games/escarmouche-game';
import { RankingAssignedEvent } from './events/ranking-assigned.event';
import { GatesCrossedEvent } from './events/gates-crossed.event';
import { VehicleDestroyedEvent } from './events/vehicle-destroyed.event';
import { ResistanceContactedEvent } from './events/resistance-contacted.event';
import { WeightClass, EXPLOIT_POINTS_BY_WEIGHT } from './enums/weight-class.enum';
import { CampaignState, ParticipantStatus } from './enums/campaign.enums';

export interface StandingsEntry {
  participantId: number;
  userId: number;
  teamId: number;
  teamName: string;
  championshipPoints: number;
  wallet: number;
  // resistancePoints délibérément absent — secret (cf. D-S4)
}

/** Un véhicule ennemi détruit par un participant (exploit, US-B2). */
export interface DestroyedVehicleInput {
  vehicleId: number;
  weightClass: WeightClass;
}

/** Un rang attribué à un participant lors de l'enregistrement d'un résultat. */
export interface RankingInput {
  participantId: number;
  rank: number;
  /** Portes franchies (exploit, US-B2) — 0/absent si aucune. */
  gatesCrossed?: number;
  /** Véhicules ennemis détruits par poids (exploit, US-B2) — vide/absent si aucun. */
  destroyedVehicles?: DestroyedVehicleInput[];
}

/** Résultat structurel d'un recordResult : événements à journaliser. */
export interface RecordResultOutcome {
  events: GameEvent[];
}

// Points de Championnat attribués par rang (index 0 = rang 1). Rang 5+ → 0.
const POINTS_TABLE = [10, 5, 2, 1];

/**
 * Agrégat racine du domaine campagne.
 *
 * Porte à la fois l'**état stocké** (name, state, inviteCode ; participants avec
 * status/isOrganizer/teamId ; parties) et l'**état rejoué** (compteurs des
 * participants, recalculés par `replay()` depuis le journal `game_events`).
 *
 * Toutes les règles métier (CRUD + jeu) sont ici. Les commandes valident les
 * invariants internes et mutent l'état en mémoire ; le repository persiste. Les
 * vérifications qui nécessitent des données externes (appartenance d'une équipe à
 * un utilisateur, unicité d'engagement, existence d'un scénario) restent dans les
 * use cases.
 */
export class Campaign {
  private _name: string;
  private _state: CampaignState;
  private readonly _inviteCode: string;
  private readonly _participants: CampaignParticipant[];
  private readonly _games: Game[];
  /** Ids de participants retirés (removeParticipant) — pour la persistance structurelle. */
  private readonly _removedParticipantIds: number[] = [];
  /** Ids de parties retirées (removeGame) — pour la persistance structurelle. */
  private readonly _removedGameIds: number[] = [];

  constructor(
    readonly id: number,
    name: string,
    state: CampaignState,
    inviteCode: string,
    participants: CampaignParticipant[],
    games: Game[],
  ) {
    this._name = name;
    this._state = state;
    this._inviteCode = inviteCode;
    this._participants = participants;
    this._games = games;
  }

  get name(): string { return this._name; }
  get state(): CampaignState { return this._state; }
  get inviteCode(): string { return this._inviteCode; }
  get participants(): readonly CampaignParticipant[] { return this._participants; }
  get games(): readonly Game[] { return this._games; }
  get removedParticipantIds(): readonly number[] { return this._removedParticipantIds; }
  get removedGameIds(): readonly number[] { return this._removedGameIds; }

  findGame(gameId: number): Game {
    const g = this._games.find((x) => x.id === gameId);
    if (!g) throw new DomainException(`Partie #${gameId} introuvable dans la campagne`);
    return g;
  }

  findParticipant(participantId: number): CampaignParticipant {
    const p = this._participants.find((x) => x.id === participantId);
    if (!p) throw new DomainException(`Participant #${participantId} introuvable dans la campagne`);
    return p;
  }

  // ── Replay ───────────────────────────────────────────────────────────────────

  /**
   * Rejoue l'intégralité du journal du début à la fin.
   * Remet tous les compteurs et états campagne à zéro avant de commencer.
   */
  replay(): void {
    for (const p of this._participants) {
      p.reset();  // wallet = team.cans, PC = 0, PR = 0 + team.resetCampaignState()
    }
    const sorted = [...this._games].sort((a, b) => a.order - b.order);
    for (const game of sorted) {
      game.apply(this._participants);
    }
  }

  /**
   * Rejoue jusqu'à la partie dont l'ordre est strictement inférieur à celui de `gameId`.
   */
  replayUpTo(gameId: number): void {
    const target = this.findGame(gameId);
    for (const p of this._participants) {
      p.reset();
    }
    const sorted = [...this._games]
      .filter((g) => g.order < target.order)
      .sort((a, b) => a.order - b.order);
    for (const game of sorted) {
      game.apply(this._participants);
    }
  }

  // ── Classement ───────────────────────────────────────────────────────────────

  /**
   * Classement public trié par Points de Championnat décroissants.
   * `resistancePoints` délibérément exclus (secret — cf. D-S4).
   */
  standings(): StandingsEntry[] {
    return [...this._participants]
      .filter((p) => p.hasTeam && p.status === ParticipantStatus.VALIDATED)
      .sort((a, b) => b.championshipPoints - a.championshipPoints)
      .map((p) => ({
        participantId: p.id,
        userId: p.userId,
        teamId: p.teamId ?? 0,
        teamName: p.team.name,
        championshipPoints: p.championshipPoints,
        wallet: p.wallet,
      }));
  }

  // ── Commandes CRUD — campagne ────────────────────────────────────────────────

  /** Renomme la campagne (organisateur — l'autorisation est vérifiée dans le use case). */
  rename(name: string): void { this._name = name; }

  /**
   * Change l'état de la campagne. Transitions bidirectionnelles (décision de design).
   * En passant à TERMINEE, clôt les ateliers OUVERT restants.
   */
  changeState(newState: CampaignState): void {
    this._state = newState;
    if (newState === CampaignState.TERMINEE) {
      this.closeCampaign();
    }
  }

  // ── Commandes CRUD — participants ────────────────────────────────────────────

  /**
   * Enregistre une demande d'inscription (participant PENDING).
   * L'appartenance de l'équipe et son unicité d'engagement sont vérifiées en amont
   * (use case). Ici : campagne EN_CONSTRUCTION et pas de demande existante.
   */
  requestJoin(userId: number, teamId: number): CampaignParticipant {
    this.assertConstruction();
    if (this._participants.some((p) => p.userId === userId)) {
      throw new DomainException('Vous avez déjà une demande d\'inscription pour cette campagne.');
    }
    const participant = new CampaignParticipant(0, userId, teamId, false, ParticipantStatus.PENDING);
    this._participants.push(participant);
    return participant;
  }

  /**
   * Valide (accept=true) ou refuse (accept=false) un participant.
   * Refuser un participant déjà VALIDATED n'est possible qu'EN_CONSTRUCTION et
   * jamais sur le dernier organisateur validé.
   */
  validateParticipant(participantId: number, accept: boolean): CampaignParticipant {
    const participant = this.findParticipant(participantId);
    if (participant.status === ParticipantStatus.VALIDATED && !accept) {
      this.assertConstruction('Cette campagne n\'accepte plus de modifications de participants.');
      this.assertNotLastOrganizer(participant, 'Impossible de refuser le dernier organisateur de la campagne.');
    }
    if (accept) participant.validate();
    else participant.reject();
    return participant;
  }

  /** Promeut un participant VALIDATED au rang de co-organisateur. */
  promoteParticipant(participantId: number): CampaignParticipant {
    const participant = this.findParticipant(participantId);
    if (participant.status !== ParticipantStatus.VALIDATED) {
      throw new DomainException('Seul un participant validé peut être promu.');
    }
    if (participant.isOrganizer) {
      throw new DomainException('Ce participant est déjà organisateur.');
    }
    participant.promote();
    return participant;
  }

  /**
   * Retire définitivement un participant. EN_CONSTRUCTION uniquement, et jamais le
   * dernier organisateur validé.
   */
  removeParticipant(participantId: number): void {
    const participant = this.findParticipant(participantId);
    this.assertConstruction('Cette campagne n\'accepte plus de modifications de participants.');
    this.assertNotLastOrganizer(participant, 'Impossible de retirer le dernier organisateur de la campagne.');
    const idx = this._participants.indexOf(participant);
    this._participants.splice(idx, 1);
    if (participant.id > 0) this._removedParticipantIds.push(participant.id);
  }

  /**
   * Change l'équipe engagée par un participant VALIDATED. EN_CONSTRUCTION uniquement.
   * Le désengagement (teamId null) est réservé à l'organisateur. L'appartenance et
   * l'unicité de l'équipe sont vérifiées en amont (use case).
   */
  changeParticipantTeam(userId: number, teamId: number | null): CampaignParticipant {
    const participant = this._participants.find(
      (p) => p.userId === userId && p.status === ParticipantStatus.VALIDATED,
    );
    if (!participant) throw new DomainException('Participant introuvable dans la campagne.');
    this.assertConstruction('Cette campagne n\'accepte plus de changement d\'équipe.');
    if (teamId === null && !participant.isOrganizer) {
      throw new DomainException('Seul un organisateur peut retirer son équipe sans en choisir une autre.');
    }
    participant.changeTeam(teamId);
    return participant;
  }

  // ── Commandes CRUD — parties ─────────────────────────────────────────────────

  /**
   * Ajoute une partie PLANIFIE en fin de programme (order = MAX+1).
   * L'existence du scénario est vérifiée en amont (use case).
   */
  addGame(scenarioId: string, type: string): Game {
    this.assertManageable();
    const order = this.nextOrder();
    const game = this.createGame(0, type, scenarioId, order, GameStatus.PLANIFIE, null, []);
    this._games.push(game);
    return game;
  }

  /** Modifie le scénario / type d'une partie PLANIFIE. */
  updateGame(gameId: number, scenarioId: string, type: string): Game {
    this.assertManageable();
    const game = this.findGame(gameId);
    this.assertPlanifie(game);
    // Remplace la partie par une instance du bon sous-type, en conservant id/order.
    const replaced = this.createGame(game.id, type, scenarioId, game.order, GameStatus.PLANIFIE, null, [...game.events]);
    const idx = this._games.indexOf(game);
    this._games.splice(idx, 1, replaced);
    return replaced;
  }

  /** Supprime une partie PLANIFIE. */
  removeGame(gameId: number): void {
    this.assertManageable();
    const game = this.findGame(gameId);
    this.assertPlanifie(game);
    const idx = this._games.indexOf(game);
    this._games.splice(idx, 1);
    if (game.id > 0) this._removedGameIds.push(game.id);
  }

  /**
   * Enregistre le résultat d'une partie : calcule les PC, journalise un
   * RankingAssignedEvent par participant (+ exploits/résistance). Ne finalise
   * PAS la partie — celle-ci reste PLANIFIE tant que le wizard de fin de partie
   * n'est pas entièrement terminé (écran 3, résolution de la Table des Épaves),
   * pour que les événements de cet écran restent acceptés par `Game.addEvent`
   * (garde de statut). La finalisation (PLANIFIE → JOUE + atelier) est une
   * action explicite et séparée, cf. `finalizeGame()`.
   *
   * Les événements créés portent id=0 ; le use case les persiste via appendEvents.
   */
  recordResult(gameId: number, rankings: RankingInput[]): RecordResultOutcome {
    const game = this.findGame(gameId);
    this.assertPlanifie(game, 'Cette partie a déjà été jouée.');

    // Rangs uniques et consécutifs à partir de 1.
    const ranks = rankings.map((r) => r.rank).sort((a, b) => a - b);
    const duplicates = new Set(ranks).size !== ranks.length;
    const consecutive = ranks.every((r, i) => r === i + 1);
    if (duplicates || !consecutive) {
      throw new DomainException('Les rangs doivent être uniques et consécutifs à partir de 1.');
    }

    // Participants VALIDATED uniquement.
    const validatedIds = new Set(
      this._participants.filter((p) => p.status === ParticipantStatus.VALIDATED).map((p) => p.id),
    );
    for (const r of rankings) {
      if (!validatedIds.has(r.participantId)) {
        throw new DomainException(`Participant ${r.participantId} inconnu ou non validé dans cette campagne.`);
      }
    }

    // Calcul des PC de classement selon le type de partie, puis événements de rang.
    const classified = Math.ceil(rankings.length / 2);
    const events: GameEvent[] = [];
    for (const r of rankings) {
      const points = this.computePoints(game.type, r.rank, classified);
      const rankingEvent = new RankingAssignedEvent(0, game.id, r.participantId, 0, r.rank, points);
      game.addEvent(rankingEvent);  // valide canAccept
      events.push(rankingEvent);

      // Points de Résistance automatiques (US-F1) : tout participant non classé (hors du
      // top `classified`) reçoit +3 PR secrets, même s'il a marqué des PC d'exploit —
      // aucune saisie manuelle, l'organisateur n'a pas d'écran dédié pour cette étape.
      if (r.rank > classified) {
        const resistanceEvent = new ResistanceContactedEvent(0, game.id, r.participantId, 0);
        game.addEvent(resistanceEvent);
        events.push(resistanceEvent);
      }

      // Exploits (US-B2) : portes franchies + véhicules ennemis détruits par poids.
      // PC figés à l'écriture (D-S8), comme pour le classement.
      if (r.gatesCrossed && r.gatesCrossed > 0) {
        const gatesEvent = new GatesCrossedEvent(0, game.id, r.participantId, 0, r.gatesCrossed, r.gatesCrossed);
        game.addEvent(gatesEvent);
        events.push(gatesEvent);
      }
      for (const destroyed of r.destroyedVehicles ?? []) {
        const exploitPoints = EXPLOIT_POINTS_BY_WEIGHT[destroyed.weightClass];
        const destroyedEvent = new VehicleDestroyedEvent(
          0, game.id, r.participantId, 0, destroyed.vehicleId, destroyed.weightClass, exploitPoints,
        );
        game.addEvent(destroyedEvent);
        events.push(destroyedEvent);
      }
    }

    return { events };
  }

  // ── Cycle de vie des parties (event sourcing) ────────────────────────────────

  /**
   * Finalise une partie (PLANIFIE → JOUE) et ouvre un AtelierGame intercalé.
   * Le nouvel atelier a id=0 (le repository lui assignera un vrai id).
   */
  finalizeGame(gameId: number): AtelierGame {
    const game = this.findGame(gameId);
    if (game.status !== GameStatus.PLANIFIE) {
      throw new DomainException('Seule une partie PLANIFIE peut être finalisée');
    }

    game.markPlayed();

    const openAtelier = this._games.find(
      (g) => g instanceof AtelierGame && g.status === GameStatus.OUVERT,
    );
    if (openAtelier) {
      openAtelier.close();
    }

    const newAtelier = new AtelierGame(0, this.id, GameStatus.OUVERT, game.order + 0.5, []);
    this._games.push(newAtelier);
    return newAtelier;
  }

  /**
   * Ferme les ateliers OUVERT restants (transition vers TERMINEE).
   */
  closeCampaign(): void {
    for (const game of this._games) {
      if (game instanceof AtelierGame && game.status === GameStatus.OUVERT) {
        game.close();
      }
    }
  }

  /**
   * Valide et enregistre un événement dans la partie, puis l'applique immédiatement.
   * Le repository persiste l'événement après cette méthode.
   */
  applyNewEvent(gameId: number, event: GameEvent): void {
    const game = this.findGame(gameId);
    game.addEvent(event);
    event.execute([...this._participants]);
  }

  // ── Helpers privés ────────────────────────────────────────────────────────────

  private assertConstruction(message = 'Action réservée à une campagne en construction.'): void {
    if (this._state !== CampaignState.EN_CONSTRUCTION) throw new DomainException(message);
  }

  private assertManageable(): void {
    if (this._state !== CampaignState.EN_CONSTRUCTION && this._state !== CampaignState.EN_COURS) {
      throw new DomainException('Le programme ne peut être géré que tant que la campagne n\'est pas terminée.');
    }
  }

  private assertPlanifie(game: Game, message = 'Une partie déjà jouée ne peut plus être modifiée.'): void {
    if (game.status !== GameStatus.PLANIFIE) throw new DomainException(message);
  }

  private assertNotLastOrganizer(participant: CampaignParticipant, message: string): void {
    if (!participant.isOrganizer) return;
    const organizers = this._participants.filter(
      (p) => p.isOrganizer && p.status === ParticipantStatus.VALIDATED,
    );
    if (organizers.length <= 1) throw new DomainException(message);
  }

  private nextOrder(): number {
    const planned = this._games.filter((g) => !(g instanceof AtelierGame));
    return planned.reduce((max, g) => Math.max(max, g.order), 0) + 1;
  }

  private computePoints(gameType: string, rank: number, classified: number): number {
    if (gameType !== 'EVENEMENT_TELE') return 0;  // ESCARMOUCHE et autres : aucun PC
    if (rank > classified) return 0;
    return POINTS_TABLE[rank - 1] ?? 0;
  }

  private createGame(
    id: number,
    type: string,
    scenarioId: string,
    order: number,
    status: GameStatus,
    playedAt: Date | null,
    events: GameEvent[],
  ): Game {
    switch (type) {
      case 'EVENEMENT_TELE':
        return new EvenementTeleGame(id, this.id, status, order, scenarioId, playedAt, events);
      case 'ESCARMOUCHE':
        return new EscarmoucheGame(id, this.id, status, order, scenarioId, playedAt, events);
      default:
        throw new DomainException(`Type de partie invalide : "${type}"`);
    }
  }
}
