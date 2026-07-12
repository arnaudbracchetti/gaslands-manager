import type { Avantage } from '../../../catalog/catalog.interfaces';

/**
 * Value Object enveloppant un `Avantage` brut du catalogue (`avantage.yml`).
 * Miroir de `ImprovementType`, en plus léger : un avantage n'occupe jamais
 * d'emplacement et ne demande jamais d'orientation, donc pas de getters `slots`/
 * `requiresOrientation` ici (contrairement à `ImprovementType`).
 */
export class AdvantageType {
  private constructor(private readonly raw: Avantage) {}

  static from(raw: Avantage): AdvantageType {
    return new AdvantageType(raw);
  }

  get nomInterne(): string {
    return this.raw.nom_interne;
  }

  get nom(): string {
    return this.raw.nom;
  }

  get categorie(): string {
    return this.raw.categorie;
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

  equals(other: AdvantageType): boolean {
    return this.raw.nom_interne === other.raw.nom_interne;
  }

  /**
   * Expose la donnée catalogue brute — nécessaire pour reconstruire la chaîne de
   * décorateurs de règles de pose depuis l'agrégat (`Vehicle.buildChain`), miroir
   * de `ImprovementType.toRaw()`.
   */
  toRaw(): Avantage {
    return this.raw;
  }
}
