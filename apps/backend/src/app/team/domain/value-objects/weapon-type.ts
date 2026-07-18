import type { Arme } from '../../../catalog/catalog.interfaces';

export class WeaponType {
  private constructor(private readonly raw: Arme) {}

  static from(raw: Arme): WeaponType {
    return new WeaponType(raw);
  }

  get nomInterne(): string {
    return this.raw.nom_interne;
  }

  get nom(): string {
    return this.raw.nom;
  }

  get price(): number {
    return this.raw.prix;
  }

  get slots(): number {
    return this.raw.emplacement;
  }

  get description(): string {
    return this.raw.description;
  }

  get regles(): string {
    return this.raw.regles;
  }

  get type(): 'base' | 'avancée' | 'équipage' | 'largable' {
    return this.raw.type;
  }

  get requiresOrientation(): boolean {
    return this.raw.necessite_orientation;
  }

  /** Cette arme peut-elle être montée sur Tourelle (arc de tir à 360°, coût ×3) ? */
  get montableSurTourelle(): boolean {
    return this.raw.montable_tourelle ?? false;
  }

  /** Nombre de munitions de départ, si cette arme en est dotée (absent = arc illimité). */
  get munitions(): number | undefined {
    return this.raw.munitions;
  }

  /** Libellé très court (1-2 mots) pour la fiche d'équipe exportable — cf. `Arme.effet_court`. */
  get effetCourt(): string | undefined {
    return this.raw.effet_court;
  }

  equals(other: WeaponType): boolean {
    return this.raw.nom_interne === other.raw.nom_interne;
  }
}
