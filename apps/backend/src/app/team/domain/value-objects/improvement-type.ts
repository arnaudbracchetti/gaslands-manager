import type { Amelioration } from '../../../catalog/catalog.interfaces';

export class ImprovementType {
  private constructor(private readonly raw: Amelioration) {}

  static from(raw: Amelioration): ImprovementType {
    return new ImprovementType(raw);
  }

  get nomInterne(): string {
    return this.raw.nom_interne;
  }

  get nom(): string {
    return this.raw.nom;
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

  get comportement(): string | undefined {
    return this.raw.comportement;
  }

  get price(): number {
    return this.raw.prix;
  }

  equals(other: ImprovementType): boolean {
    return this.raw.nom_interne === other.raw.nom_interne;
  }

  /**
   * Expose la donnée catalogue brute (`Amelioration`) — nécessaire pour reconstruire
   * la chaîne de décorateurs de règles de pose depuis l'agrégat (`Vehicle.canAddImprovement`).
   * Miroir de `VehicleType.toRaw()`.
   */
  toRaw(): Amelioration {
    return this.raw;
  }
}
