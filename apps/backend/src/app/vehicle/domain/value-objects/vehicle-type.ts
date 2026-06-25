import type { Vehicule } from '../../../catalog/catalog.interfaces';

export class VehicleType {
  private constructor(private readonly raw: Vehicule) {}

  static from(raw: Vehicule): VehicleType {
    return new VehicleType(raw);
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
    return this.raw.emplacements;
  }

  get carrosserie(): number {
    return this.raw.carrosserie;
  }

  get manoeuvrabilite(): number {
    return this.raw.manoeuvrabilite;
  }

  get vitesseMax(): number {
    return this.raw.vitesse_max;
  }

  get equipage(): number {
    return this.raw.equipage;
  }

  get poids(): 'Léger' | 'Moyen' | 'Lourd' {
    return this.raw.poids;
  }

  get description(): string {
    return this.raw.description;
  }

  get regles(): string {
    return this.raw.regles;
  }

  get defaultImprovements(): string[] {
    return this.raw.ameliorations_defaut ?? [];
  }

  /** Retourne le Vehicule brut du catalogue — nécessaire pour les factories du Pattern Decorator. */
  toRaw(): Vehicule {
    return this.raw;
  }

  equals(other: VehicleType): boolean {
    return this.raw.nom_interne === other.raw.nom_interne;
  }
}
