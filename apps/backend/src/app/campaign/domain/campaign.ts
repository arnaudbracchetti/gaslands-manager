import { DomainException } from '../../shared/domain/domain-exception';
import { CampaignParticipant } from './campaign-participant';
import type { Game } from './games/game';
import type { GameEvent } from './events/game-event';
import { GameStatus } from './enums/game-status.enum';
import { EvenementTeleGame } from './games/evenement-tele-game';
import { EscarmoucheGame } from './games/escarmouche-game';
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

  /**
   * Retrouve l'unique partie actuellement en `ATELIER` — invariant "un seul atelier
   * actif à la fois par campagne", qui porte sur l'ensemble des parties et ne peut
   * donc pas vivre sur une `Game` isolée.
   */
  findAtelierGame(): Game {
    const game = this._games.find((g) => g.status === GameStatus.ATELIER);
    if (!game) throw new DomainException('Aucun atelier ouvert actuellement.');
    return game;
  }

  // ── Replay ───────────────────────────────────────────────────────────────────

  /**
   * Rejoue l'intégralité du journal du début à la fin.
   * Remet tous les compteurs et états campagne à zéro avant de commencer.
   */
  replay(): void {
    for (const p of this._participants) {
      p.reset();  // wallet = team.remainingBudget, PC = 0, PR = 0 + team.resetCampaignState()
    }
    const sorted = [...this._games].sort((a, b) => a.order - b.order);
    for (const game of sorted) {
      game.replayEvents(this._participants);
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
    if (teamId !== participant.teamId && this.hasParticipantHistory(participant.id)) {
      throw new DomainException(
        'Ce participant a déjà des événements journalisés dans cette campagne : ' +
          'son équipe engagée ne peut plus être changée.',
      );
    }
    participant.changeTeam(teamId);
    return participant;
  }

  /**
   * Vrai si ce participant a au moins un `GameEvent` journalisé dans cette campagne
   * (a déjà joué). Verrouille son équipe engagée même si la campagne revient en
   * `EN_CONSTRUCTION` (transitions bidirectionnelles, cf. `changeState`) — sans cette
   * garde, rattacher le participant à une autre équipe au prochain replay fait
   * échouer tout événement historique qui référence un véhicule de l'équipe
   * d'origine (`Team.findVehicle` introuvable), cf. spec/CAMPAIGN.md.
   */
  private hasParticipantHistory(participantId: number): boolean {
    return this._games.some((g) => g.events.some((e) => e.participantId === participantId));
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

  // ── Cycle de vie des parties (event sourcing) ────────────────────────────────

  /**
   * Fait entrer une partie en atelier (PLANIFIE → ATELIER) : résultat enregistré,
   * phase garage post-partie ouverte. Si une autre partie est encore en ATELIER,
   * elle est automatiquement clôturée (ATELIER → JOUE) — un seul atelier actif à
   * la fois par campagne. L'id de cette partie auto-clôturée est retourné pour
   * que l'appelant puisse en avertir l'organisateur.
   */
  enterAtelier(gameId: number): { autoClosedGameId: number | null } {
    const game = this.findGame(gameId);
    if (game.status !== GameStatus.PLANIFIE) {
      throw new DomainException('Seule une partie PLANIFIE peut entrer en atelier.');
    }

    const openAtelier = this._games.find(
      (g) => g.id !== gameId && g.status === GameStatus.ATELIER,
    );
    let autoClosedGameId: number | null = null;
    if (openAtelier) {
      openAtelier.closeAtelier();
      autoClosedGameId = openAtelier.id;
    }

    game.enterAtelier();
    return { autoClosedGameId };
  }

  /** Clôture manuelle de l'atelier d'une partie (ATELIER → JOUE), par l'organisateur. */
  closeAtelier(gameId: number): void {
    const game = this.findGame(gameId);
    if (game.status !== GameStatus.ATELIER) {
      throw new DomainException("Cette partie n'est pas en atelier.");
    }
    game.closeAtelier();
  }

  /**
   * Clôture toute partie encore en ATELIER (transition de la campagne vers TERMINEE).
   */
  closeCampaign(): void {
    for (const game of this._games) {
      if (game.status === GameStatus.ATELIER) {
        game.closeAtelier();
      }
    }
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
    return this._games.reduce((max, g) => Math.max(max, g.order), 0) + 1;
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
