import type { Team } from '../../team/domain/team';

/**
 * Participant à une saison campagne — Receiver GoF.
 *
 * Porte tous les compteurs transients d'un joueur pour la durée de la saison :
 * wallet (cagnotte), championshipPoints (PC) et resistancePoints (PR, secret).
 * Ces valeurs ne sont JAMAIS persistées — elles sont recalculées à chaque replay.
 *
 * Le `Team` est « attaché » avant le replay via `attachTeam()`. Le team chargé
 * est l'état figé de départ (snapshot persisté) sur lequel les GameEvent appliquent
 * leurs effets transients (perte, chocs, séquelles, équipement acheté).
 */
export class CampaignParticipant {
  private _team!: Team;
  private _wallet = 0;
  private _championshipPoints = 0;
  private _resistancePoints = 0;

  constructor(
    readonly id: number,
    readonly userId: number,
    readonly teamId: number,
    readonly isOrganizer: boolean,
  ) {}

  get team(): Team { return this._team; }
  get wallet(): number { return this._wallet; }
  get championshipPoints(): number { return this._championshipPoints; }
  get resistancePoints(): number { return this._resistancePoints; }

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
   * Wallet initialisé à team.cans (budget d'équipe figé).
   */
  reset(): void {
    this._wallet = this._team.cans;
    this._championshipPoints = 0;
    this._resistancePoints = 0;
    this._team.resetCampaignState();
  }

  creditWallet(amount: number): void { this._wallet += amount; }
  addPoints(n: number): void { this._championshipPoints += n; }
  addResistance(n: number): void { this._resistancePoints += n; }
}
