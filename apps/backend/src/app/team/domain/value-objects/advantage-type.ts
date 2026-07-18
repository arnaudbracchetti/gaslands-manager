import type { Avantage } from '../../../catalog/catalog.interfaces';
import { resolveAdvantageBehavior } from '../behaviors/advantage-behaviors';
import type { PlacementCandidate, PlacementContext, RuleResult } from '../behaviors/equipment-behavior';

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

  /** Libellé très court (1-2 mots) pour la fiche d'équipe exportable — cf. `Arme.effet_court`. */
  get effetCourt(): string | undefined {
    return this.raw.effet_court;
  }

  equals(other: AdvantageType): boolean {
    return this.raw.nom_interne === other.raw.nom_interne;
  }

  /**
   * Règle de pose (Strategy GoF, cf. `domain/behaviors/advantage-behaviors.ts`) — délègue
   * au comportement résolu depuis `comportement`. Vit ici plutôt que sur `Advantage`
   * (l'entité) : au moment de valider un CANDIDAT, aucune instance n'existe encore, seul
   * son Type est disponible (cf. `Vehicle.canAddAdvantage`).
   */
  canPlace(ctx: PlacementContext, candidate: PlacementCandidate): RuleResult {
    return resolveAdvantageBehavior(this.comportement).canPlace(ctx, candidate);
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
