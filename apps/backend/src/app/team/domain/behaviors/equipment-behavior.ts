import type { Orientation, RuleResult } from '../team';
import { ok } from '../team';

/** Ré-exporté : `RuleResult` fait partie du vocabulaire de la Strategy (retour de `canPlace`),
 *  les fichiers `*-behaviors.ts` l'importent depuis ce module plutôt que directement `../team`. */
export type { RuleResult };

/**
 * Profil chiffré d'un véhicule "monté" — accumulation des effets de toutes les couches
 * d'équipement (séquelles, améliorations, avantages) au-dessus du profil catalogue.
 * Remplace l'ancien `VehicleBuild`/`CatalogVehicleBuild` (Pattern Decorator) : ici, un
 * simple objet de données plié par `Vehicle` lui-même via `reduce()`, jamais une chaîne
 * d'objets qui s'enveloppent.
 */
export interface VehicleStats {
  nom_interne: string;
  poids: 'Léger' | 'Moyen' | 'Lourd';
  carrosserie: number;
  manoeuvrabilite: number;
  vitesse_max: number;
  equipage: number;
  /** Capacité en emplacements — normalement fixe (catalogue), mais certaines améliorations
   *  (Remorque Moyenne/Lourde) l'augmentent via `applyStats`. */
  emplacements: number;
}

/** Une ligne du récapitulatif d'un véhicule monté — une par équipement, du châssis au dernier ajouté. */
export interface VehicleStatsSummary {
  nom: string;
}

/** Ce que la Strategy du candidat a besoin de connaître sur lui-même pour se prononcer. */
export interface PlacementCandidate {
  readonly nomInterne: string;
  readonly nom: string;
  readonly orientation: Orientation | null;
}

/**
 * État courant du véhicule, tel que vu par le candidat en cours de validation — jamais
 * la chaîne complète, jamais les couches déjà validées à nouveau (contrairement à
 * l'ancien `ImprovementDecorator.validate()`, qui revalidait tout à chaque appel sans
 * qu'aucune couche existante ne puisse jamais devenir invalide entre-temps).
 * `currentStats` est déjà calculé (base → séquelles → couches EXISTANTES de la même
 * catégorie que le candidat) — le candidat lui-même n'y est pas encore inclus.
 * `installedCount`/`hasOrientation` sont déjà scopés au `comportement` du candidat par
 * `Vehicle` — aucune Strategy n'a donc besoin de connaître ou répéter sa propre clé de
 * registre.
 */
export interface PlacementContext {
  readonly baseStats: VehicleStats;
  readonly currentStats: VehicleStats;
  readonly installedCount: number;
  hasOrientation(o: Orientation): boolean;
  /**
   * Vrai si au moins une amélioration active (posée, ni vendue ni perdue) du véhicule a
   * un `comportement` présent dans `comportements` — traverse TOUTES les catégories,
   * contrairement à `installedCount` qui reste scopé au seul comportement du candidat.
   * C'est la Strategy qui fournit la liste (elle seule connaît sa propre "famille",
   * ex. les 3 comportements de remorque mutuellement exclusifs) ; `Vehicle` ne fait
   * qu'exécuter la recherche sur l'état qu'il possède déjà.
   */
  hasComportementAmong(comportements: readonly string[]): boolean;
}

/**
 * Strategy GoF : une classe stateless par comportement de jeu (Chenilles, Bélier,
 * Cascadeur…), invoquée directement par `Vehicle` sur l'état qu'il lui fournit — jamais
 * de chaînage (`this.inner`) comme l'ancien Pattern Decorator. Une seule instance de
 * chaque classe suffit pour toute l'application (cf. les registres
 * `IMPROVEMENT_BEHAVIORS`/`ADVANTAGE_BEHAVIORS`), puisqu'aucune ne porte d'état propre.
 */
export interface EquipmentBehavior {
  /** Effet pur sur le profil accumulé jusque-là. Par défaut : aucun effet (identité). */
  applyStats(current: VehicleStats): VehicleStats;
  /** Règle de pose du candidat. Par défaut : toujours autorisé. */
  canPlace(ctx: PlacementContext, candidate: PlacementCandidate): RuleResult;
}

/**
 * Base commune fournissant les 2 défauts — 8 des 13 comportements ne surchargent qu'UNE
 * seule des deux méthodes ; l'héritage évite de répéter l'autre à chaque fois.
 */
export abstract class EquipmentBehaviorBase implements EquipmentBehavior {
  applyStats(current: VehicleStats): VehicleStats {
    return current;
  }

  canPlace(_ctx: PlacementContext, _candidate: PlacementCandidate): RuleResult {
    return ok();
  }
}

class NeutralEquipmentBehavior extends EquipmentBehaviorBase {}

/** Pour tout comportement absent ou non trouvé dans un registre — aucun effet, toujours autorisé. */
export const NEUTRAL_EQUIPMENT_BEHAVIOR: EquipmentBehavior = new NeutralEquipmentBehavior();
