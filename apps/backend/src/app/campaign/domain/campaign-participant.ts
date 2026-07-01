import type { Team } from '../../team/domain/team';
import { ParticipantStatus } from '../campaign.enums';

/**
 * Participant à une campagne.
 *
 * Porte deux natures de données (agrégat unifié — CRUD + event sourcing) :
 *
 * - **État stocké** (source de vérité en table `campaign_participants`) :
 *   `status`, `isOrganizer`, `teamId`. Muté par les commandes CRUD de l'agrégat
 *   (validation, promotion, changement d'équipe) et persisté par le repository.
 *
 * - **État rejoué** (jamais persisté — Receiver GoF) : `wallet`,
 *   `championshipPoints`, `resistancePoints`. Recalculé à chaque replay du journal
 *   `game_events` ; `attachTeam()` remet ces compteurs à zéro avant le rejeu.
 */
export class CampaignParticipant {
  private _team: Team | undefined;
  private _wallet = 0;
  private _championshipPoints = 0;
  private _resistancePoints = 0;

  private _teamId: number | null;
  private _isOrganizer: boolean;
  private _status: ParticipantStatus;

  constructor(
    readonly id: number,
    readonly userId: number,
    teamId: number | null,
    isOrganizer: boolean,
    status: ParticipantStatus = ParticipantStatus.VALIDATED,
  ) {
    this._teamId = teamId;
    this._isOrganizer = isOrganizer;
    this._status = status;
  }

  // ── État stocké ────────────────────────────────────────────────────────────
  get teamId(): number | null { return this._teamId; }
  get isOrganizer(): boolean { return this._isOrganizer; }
  get status(): ParticipantStatus { return this._status; }

  // ── État rejoué ────────────────────────────────────────────────────────────
  get team(): Team { return this._team as Team; }
  get hasTeam(): boolean { return this._team !== undefined; }
  get wallet(): number { return this._wallet; }
  get championshipPoints(): number { return this._championshipPoints; }
  get resistancePoints(): number { return this._resistancePoints; }

  // ── Mutations CRUD (état stocké) ──────────────────────────────────────────

  /** Passe le participant à VALIDATED (validation d'une demande ou revalidation). */
  validate(): void { this._status = ParticipantStatus.VALIDATED; }

  /** Passe le participant à REJECTED (refus d'une demande ou d'un participant validé). */
  reject(): void { this._status = ParticipantStatus.REJECTED; }

  /** Promeut le participant au rang de co-organisateur. */
  promote(): void { this._isOrganizer = true; }

  /** Change l'équipe engagée (null = désengagement, réservé à l'organisateur). */
  changeTeam(teamId: number | null): void { this._teamId = teamId; }

  // ── État rejoué (Receiver GoF) ────────────────────────────────────────────

  /**
   * Attache le Team (état figé) et remet tous les compteurs à zéro.
   * Appelé par Campaign.replay() avant de rejouer le journal.
   */
  attachTeam(team: Team): void {
    this._team = team;
    this.reset();
  }

  /**
   * Remet les compteurs à leur état de départ.
   * Wallet initialisé à team.cans (budget d'équipe figé). Sans équipe attachée,
   * le participant ne joue pas — les compteurs restent nuls.
   */
  reset(): void {
    if (this._team === undefined) return;
    this._wallet = this._team.cans;
    this._championshipPoints = 0;
    this._resistancePoints = 0;
    this._team.resetCampaignState();
  }

  creditWallet(amount: number): void { this._wallet += amount; }
  addPoints(n: number): void { this._championshipPoints += n; }
  addResistance(n: number): void { this._resistancePoints += n; }
}
