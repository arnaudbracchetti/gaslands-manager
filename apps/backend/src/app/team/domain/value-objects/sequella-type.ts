/**
 * Données brutes d'une séquelle de campagne.
 * Miroir de ce que sera éventuellement un YAML de catalogue — défini statiquement
 * dans `sequella-decorators.ts` (pas de fichier YAML dédié pour l'instant).
 */
export interface RawSequella {
  nom: string;
  nom_interne: string;
  description: string;
  /** Nombre de Chocs nécessaires pour acquérir cette séquelle (validé par AddSequallaUseCase). */
  chocs_cost: number;
}

/**
 * Value Object représentant un type de séquelle de campagne.
 *
 * Même pattern que WeaponType / ImprovementType : enveloppe des données brutes
 * et expose une API métier typée. Instances définies statiquement dans
 * `sequella-decorators.ts` (catalogue en mémoire).
 */
export class SequellaType {
  private constructor(private readonly raw: RawSequella) {}

  static from(raw: RawSequella): SequellaType {
    return new SequellaType(raw);
  }

  get nomInterne(): string {
    return this.raw.nom_interne;
  }

  get nom(): string {
    return this.raw.nom;
  }

  get description(): string {
    return this.raw.description;
  }

  /** Coût en Chocs pour acquérir cette séquelle (validé en write-time par AddSequallaUseCase). */
  get chocsCost(): number {
    return this.raw.chocs_cost;
  }

  equals(other: SequellaType): boolean {
    return this.raw.nom_interne === other.raw.nom_interne;
  }
}
