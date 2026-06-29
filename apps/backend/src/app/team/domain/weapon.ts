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

  constructor(
    readonly id: number,
    readonly type: WeaponType,
    readonly orientation: Orientation | null,
  ) {}

  get price(): number {
    return this.type.price;
  }

  /**
   * Emplacements occupés par cette arme.
   * Retourne 0 si l'arme est perdue : l'emplacement est libéré pour un remplacement
   * (règle campagne Gaslands). `price` reste inchangé — perdre une arme n'implique
   * aucun remboursement, le coût a été payé lors de l'achat initial.
   */
  get slots(): number {
    return this._isLost ? 0 : this.type.slots;
  }

  get isLost(): boolean {
    return this._isLost;
  }

  /** Idempotent : marquer une arme déjà perdue n'a pas d'effet supplémentaire. */
  markLost(): void {
    this._isLost = true;
  }

  clearLost(): void {
    this._isLost = false;
  }

  /** Remet l'état campaign à zéro — appelé par Vehicle.clearCampaignState() au début du replay. */
  clearCampaignState(): void {
    this._isLost = false;
  }
}
