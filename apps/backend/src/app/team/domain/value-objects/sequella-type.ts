import type { Sequelle } from '../../../catalog/catalog.interfaces';

/**
 * Value Object enveloppant une `Sequelle` brute du catalogue (`sequelle.yml`).
 *
 * Miroir de `AdvantageType`, en plus léger : pas de `categorie`/`comportement`/`regles`
 * ni de `toRaw()` — aucune séquelle n'est aujourd'hui pliée dans la chaîne de
 * décorateurs de stats effectives (`Vehicle.buildChain`), réservé à une Partie 5
 * future (cf. `sequella-decorators.ts`).
 */
export class SequellaType {
  private constructor(private readonly raw: Sequelle) {}

  static from(raw: Sequelle): SequellaType {
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

  /** Coût en Chocs pour acquérir cette séquelle (0 pour une séquelle `TABLE_EPAVES`). */
  get chocsCost(): number {
    return this.raw.chocs_cost;
  }

  /** Distingue un achat volontaire en atelier d'une imposition automatique (Table des Épaves). */
  get origine(): 'ATELIER' | 'TABLE_EPAVES' {
    return this.raw.origine;
  }

  equals(other: SequellaType): boolean {
    return this.raw.nom_interne === other.raw.nom_interne;
  }
}
