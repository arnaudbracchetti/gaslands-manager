import type { Amelioration } from '../../../catalog/catalog.interfaces';
import { resolveImprovementBehavior } from '../behaviors/improvement-behaviors';
import type { PlacementCandidate, PlacementContext, RuleResult } from '../behaviors/equipment-behavior';

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

  get requiresOrientation(): boolean {
    return this.raw.necessite_orientation;
  }

  get price(): number {
    return this.raw.prix;
  }

  /** Libellé très court (1-2 mots) pour la fiche d'équipe exportable — cf. `Arme.effet_court`. */
  get effetCourt(): string | undefined {
    return this.raw.effet_court;
  }

  /** Nombre d'utilisations de départ, si cette amélioration en est dotée (absent = illimité). */
  get munitions(): number | undefined {
    return this.raw.munitions;
  }

  equals(other: ImprovementType): boolean {
    return this.raw.nom_interne === other.raw.nom_interne;
  }

  /**
   * Règle de pose (Strategy GoF, cf. `domain/behaviors/improvement-behaviors.ts`) — délègue
   * au comportement résolu depuis `comportement`. Vit ici plutôt que sur `Improvement`
   * (l'entité) : au moment de valider un CANDIDAT, aucune instance n'existe encore, seul
   * son Type est disponible (cf. `Vehicle.canAddImprovement`).
   */
  canPlace(ctx: PlacementContext, candidate: PlacementCandidate): RuleResult {
    return resolveImprovementBehavior(this.comportement).canPlace(ctx, candidate);
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
