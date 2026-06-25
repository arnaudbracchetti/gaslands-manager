import type { WeaponType } from './value-objects/weapon-type';
import type { Orientation } from '../vehicle-build';

/**
 * Une arme montée sur un véhicule d'équipe (instance de jeu).
 * Entité enfant de l'agrégat Vehicle — ne vit pas indépendamment.
 *
 * Distinct du catalogue : WeaponType porte les données de référence (prix, règles...),
 * Weapon porte l'état propre à cette instance (orientation choisie au moment de la pose).
 */
export class Weapon {
  constructor(
    readonly id: number,
    readonly type: WeaponType,
    readonly orientation: Orientation | null,
  ) {}

  get price(): number {
    return this.type.price;
  }

  get slots(): number {
    return this.type.slots;
  }
}
