import type { WeaponType } from './value-objects/weapon-type';
import type { Orientation } from './team';

/**
 * Une arme montée sur un véhicule d'équipe (instance de jeu).
 * Entité enfant de Vehicle, lui-même entité enfant de l'agrégat Team.
 *
 * Distinct du catalogue : WeaponType porte les données de référence (prix, règles...),
 * Weapon porte l'état propre à cette instance (orientation choisie au moment de la pose).
 */
export class Weapon {
  private _isLost = false;
  private _isSold = false;

  constructor(
    readonly id: number,
    readonly type: WeaponType,
    readonly orientation: Orientation | null,
  ) {}

  /**
   * Prix résiduel une fois vendue : ce qui reste après remboursement à moitié prix
   * (floor). floor(X/2) remboursé (via le budget dérivé, cf. CampaignParticipant.wallet)
   * + ceil(X/2) résiduel = X. Jamais 0 (affichage lisible sur la carte barrée), jamais
   * le plein prix (le remboursement a bien eu lieu).
   */
  get price(): number {
    return this._isSold ? Math.ceil(this.type.price / 2) : this.type.price;
  }

  /**
   * Emplacements occupés par cette arme.
   * Retourne 0 si l'arme est perdue OU vendue : l'emplacement est libéré (perte : pour un
   * remplacement ; vente : l'arme n'est physiquement plus sur le véhicule). `price` ne
   * s'annule jamais complètement en revanche — cf. son commentaire (résiduel vs remboursement).
   */
  get slots(): number {
    return this._isLost || this._isSold ? 0 : this.type.slots;
  }

  get isLost(): boolean {
    return this._isLost;
  }

  get isSold(): boolean {
    return this._isSold;
  }

  /** Idempotent : marquer une arme déjà perdue n'a pas d'effet supplémentaire. */
  markLost(): void {
    this._isLost = true;
  }

  clearLost(): void {
    this._isLost = false;
  }

  /** Idempotent : marquer une arme déjà vendue n'a pas d'effet supplémentaire. */
  markSold(): void {
    this._isSold = true;
  }

  clearSold(): void {
    this._isSold = false;
  }

  /** Remet l'état campaign à zéro — appelé par Vehicle.clearCampaignState() au début du replay. */
  clearCampaignState(): void {
    this._isLost = false;
    this._isSold = false;
  }
}
