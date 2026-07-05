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

  constructor(
    readonly id: number,
    readonly type: ImprovementType,
    readonly orientation: Orientation | null,
    readonly estDefaut: boolean,
  ) {}

  get weaponAssignee(): WeaponType | null {
    return this._weaponAssignee;
  }

  get price(): number {
    if (this.estDefaut) return 0;
    if (this.type.isTourelle) {
      return this._weaponAssignee ? this._weaponAssignee.price * 3 : 0;
    }
    return this.type.price;
  }

  /**
   * Emplacements occupés par cette amélioration.
   * Retourne 0 si l'amélioration est perdue (Table des Épaves, ligne ARRACHEE) — même
   * raisonnement que `Weapon.slots` : l'emplacement est libéré, le coût n'est pas remboursé.
   */
  get slots(): number {
    if (this.estDefaut || this._isLost) return 0;
    return this.type.slots;
  }

  get isLost(): boolean {
    return this._isLost;
  }

  /** Idempotent : marquer une amélioration déjà perdue n'a pas d'effet supplémentaire. */
  markLost(): void {
    this._isLost = true;
  }

  clearLost(): void {
    this._isLost = false;
  }

  /** Remet l'état campagne à zéro — appelé par Vehicle/Team.clearCampaignState() au début du replay. */
  clearCampaignState(): void {
    this._isLost = false;
  }

  assignWeapon(weaponType: WeaponType): void {
    this._weaponAssignee = weaponType;
  }

  unassignWeapon(): void {
    this._weaponAssignee = null;
  }
}
