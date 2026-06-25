import type { ImprovementType } from './value-objects/improvement-type';
import type { WeaponType } from './value-objects/weapon-type';
import type { Orientation } from '../vehicle-build';

/**
 * Une amélioration montée sur un véhicule d'équipe (instance de jeu).
 * Entité enfant de l'agrégat Vehicle — ne vit pas indépendamment.
 *
 * Cas particulier de la Tourelle : elle porte une arme assignée (weaponAssignee)
 * dont le prix détermine son coût total (3×). assignWeapon/unassignWeapon
 * mutent cet état directement sur l'entité.
 */
export class Improvement {
  private _weaponAssignee: WeaponType | null = null;

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

  get slots(): number {
    if (this.estDefaut) return 0;
    return this.type.slots;
  }

  assignWeapon(weaponType: WeaponType): void {
    this._weaponAssignee = weaponType;
  }

  unassignWeapon(): void {
    this._weaponAssignee = null;
  }
}
