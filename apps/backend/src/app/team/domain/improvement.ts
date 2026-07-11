import type { ImprovementType } from './value-objects/improvement-type';
import type { WeaponType } from './value-objects/weapon-type';
import type { Orientation } from './team';

/**
 * Une amélioration montée sur un véhicule d'équipe (instance de jeu).
 * Entité enfant de Vehicle, lui-même entité enfant de l'agrégat Team.
 *
 * Cas particulier de la Tourelle : elle porte une arme assignée (weaponAssignee)
 * dont le prix détermine son coût total (3×). assignWeapon/unassignWeapon
 * mutent cet état directement sur l'entité.
 */
export class Improvement {
  private _weaponAssignee: WeaponType | null = null;
  private _isLost = false;
  private _isSold = false;

  constructor(
    readonly id: number,
    readonly type: ImprovementType,
    readonly orientation: Orientation | null,
    readonly estDefaut: boolean,
  ) {}

  get weaponAssignee(): WeaponType | null {
    return this._weaponAssignee;
  }

  /**
   * Prix résiduel une fois vendue : ce qui reste après remboursement à moitié prix
   * (floor), appliqué au prix de base normalement calculé (estDefaut/Tourelle
   * inchangés). floor(X/2) remboursé + ceil(X/2) résiduel = X.
   */
  get price(): number {
    if (this.estDefaut) return 0;
    const basePrice = this.type.isTourelle
      ? (this._weaponAssignee ? this._weaponAssignee.price * 3 : 0)
      : this.type.price;
    return this._isSold ? Math.ceil(basePrice / 2) : basePrice;
  }

  /**
   * Emplacements occupés par cette amélioration.
   * Retourne 0 si l'amélioration est perdue (Table des Épaves, ligne ARRACHEE) OU vendue
   * — même raisonnement que `Weapon.slots` : l'emplacement est libéré, le prix ne
   * s'annule jamais complètement (résiduel pour la vente, inchangé pour la perte).
   */
  get slots(): number {
    if (this.estDefaut || this._isLost || this._isSold) return 0;
    return this.type.slots;
  }

  get isLost(): boolean {
    return this._isLost;
  }

  get isSold(): boolean {
    return this._isSold;
  }

  /** Idempotent : marquer une amélioration déjà perdue n'a pas d'effet supplémentaire. */
  markLost(): void {
    this._isLost = true;
  }

  clearLost(): void {
    this._isLost = false;
  }

  /** Idempotent : marquer une amélioration déjà vendue n'a pas d'effet supplémentaire. */
  markSold(): void {
    this._isSold = true;
  }

  clearSold(): void {
    this._isSold = false;
  }

  /** Remet l'état campagne à zéro — appelé par Vehicle/Team.clearCampaignState() au début du replay. */
  clearCampaignState(): void {
    this._isLost = false;
    this._isSold = false;
  }

  assignWeapon(weaponType: WeaponType): void {
    this._weaponAssignee = weaponType;
  }

  unassignWeapon(): void {
    this._weaponAssignee = null;
  }
}
