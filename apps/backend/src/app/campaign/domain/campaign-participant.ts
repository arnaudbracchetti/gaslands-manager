import type { Team } from '../../team/domain/team';
import { ParticipantStatus } from './enums/campaign.enums';
import { DomainException } from '../../shared/domain/domain-exception';

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
 *
 * `wallet` n'est PLUS un compteur mutable : il est dérivé de `team.remainingBudget`
 * (achats/reventes d'équipement modifient l'arbre d'entités, jamais le wallet
 * directement) + `_rewardsEarned` (récompenses manuelles, seul mouvement qui n'a pas de
 * contrepartie dans l'arbre d'équipement). Preuve algébrique de l'équivalence avec
 * l'ancien compteur mutable : docs/plans/2026-07-11-atelier-annulation-revente-design.md §3.
 */
export class CampaignParticipant {
  private _team: Team | undefined;
  private _rewardsEarned = 0;
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

  /** Cagnotte dérivée : budget non dépensé (`team.remainingBudget`) + récompenses cumulées. */
  get wallet(): number {
    return this.hasTeam ? this.team.remainingBudget + this._rewardsEarned : 0;
  }

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
   * Remet les compteurs à leur état de départ. Le wallet n'est plus remis à zéro ici : il
   * est dérivé (`wallet` getter), donc il retombe automatiquement au bon montant dès que
   * `team.resetCampaignState()` a remis les prix résiduels/pertes à zéro sur l'équipe.
   * Sans équipe attachée, le participant ne joue pas — compteurs nuls (wallet = 0 via
   * `hasTeam`).
   */
  reset(): void {
    if (this._team === undefined) return;
    this._rewardsEarned = 0;
    this._championshipPoints = 0;
    this._resistancePoints = 0;
    this._team.resetCampaignState();
  }

  /** Ne crédite plus que les récompenses (`WalletMovementEvent`) — jamais les achats/reventes d'équipement, qui passent par l'arbre d'entités (cf. doc de classe). */
  creditWallet(amount: number): void { this._rewardsEarned += amount; }
  addPoints(n: number): void { this._championshipPoints += n; }
  addResistance(n: number): void { this._resistancePoints += n; }

  /**
   * Garde de domaine : le participant a-t-il assez de cagnotte pour une dépense de `cost` ?
   * Lève `DomainException` sinon. Vérifiée AVANT de journaliser un achat d'atelier — le use
   * case n'exécute pas l'événement avant la persistance (D-S11), l'affordability ne peut donc
   * pas s'appuyer sur un effet de bord sur le wallet, elle est portée par cette garde explicite.
   */
  assertCanAfford(cost: number): void {
    if (this.wallet < cost) {
      throw new DomainException(`Cagnotte insuffisante (${this.wallet} jerricans, coût : ${cost}).`);
    }
  }
}
