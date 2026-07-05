/**
 * Décorateurs de séquelles campagne Gaslands.
 *
 * Pattern GoF Decorator — même infrastructure que `improvement-decorators.ts`.
 * Les séquelles étendent `ImprovementDecorator` et modifient les stats du véhicule
 * de façon permanente (dommages de campagne, non persistés — reconstruits au replay).
 *
 * Chaque séquelle est identifiée par un `SequellaType` (Value Object, même modèle
 * que `WeaponType` / `ImprovementType`). `Vehicle.addSequella(type)` stocke le Value
 * Object ; `VehicleBuildFactory` (Partie 5) utilise `type.nomInterne` pour retrouver
 * la factory dans `SEQUELLA_REGISTRY` et instancier le décorateur au moment du calcul
 * des stats.
 *
 * Différences avec ImprovementDecorator ordinaire :
 * - `emplacement: 0`  — les séquelles ne consomment pas d'emplacement
 * - `validate()` délègue directement à `inner` — la validation se fait au
 *   write-time (`AddSequallaUseCase`), jamais au replay
 */

import { ImprovementDecorator, type VehicleBuild, type VehicleStats } from './vehicle-build';
import { SequellaType } from './value-objects/sequella-type';
import type { Amelioration } from '../../catalog/catalog.interfaces';

// ── Base commune ──────────────────────────────────────────────────────────────

/**
 * Classe de base pour toutes les séquelles.
 * Construit un objet `Amelioration` factice depuis le `SequellaType` (emplacement = 0,
 * prix = 0) pour satisfaire l'interface de `ImprovementDecorator` — les séquelles
 * ne font pas partie du catalogue d'équipement.
 */
abstract class SequellaDecorator extends ImprovementDecorator {
  constructor(inner: VehicleBuild, sequellaType: SequellaType) {
    const amelioration: Amelioration = {
      nom: sequellaType.nom,
      nom_interne: sequellaType.nomInterne,
      prix: 0,
      emplacement: 0,
      description: sequellaType.description,
      regles: '',
      sponsors_autorises: [],
    };
    super(inner, amelioration, { nom_interne: sequellaType.nomInterne });
  }

  /**
   * Les séquelles ne passent PAS par la validation générique (contrôle de capacité).
   * Elles ont `emplacement: 0`, donc ne dépassent jamais la capacité — mais surtout,
   * elles sont posées au write-time avec une validation métier dédiée, pas au replay.
   * On délègue directement vers le maillon inférieur pour que la chaîne reste valide.
   */
  override validate() {
    return this.inner.validate();
  }
}

// ── Types de séquelles (catalogue statique) ───────────────────────────────────
// Compléter selon les règles officielles Gaslands Refuelled.

export const SEQUELLA_MOTEUR_ENDOMMAGE = SequellaType.from({
  nom: 'Moteur endommagé',
  nom_interne: 'moteur_endommage',
  description: 'Vitesse maximale réduite de 1 (minimum 1).',
  chocs_cost: 2,
});

export const SEQUELLA_DIRECTION_ENDOMMAGE = SequellaType.from({
  nom: 'Direction endommagée',
  nom_interne: 'direction_endommage',
  description: 'Manoeuvrabilité réduite de 1 (minimum 1).',
  chocs_cost: 2,
});

export const SEQUELLA_BLINDAGE_ARRACHE = SequellaType.from({
  nom: 'Blindage arraché',
  nom_interne: 'blindage_arrache',
  description: 'Carrosserie réduite de 2 (minimum 0).',
  chocs_cost: 3,
});

/**
 * Imposée par la Table des Épaves (ligne 7, `SIEGE_IRRECUPERABLE`), jamais achetée en
 * Atelier — `WreckResolveUseCase` construit toujours son `SequellaAddedEvent` avec un
 * coût de 0 (le tirage l'impose gratuitement, contrairement à un échange volontaire).
 */
export const SEQUELLA_SIEGE_IRRECUPERABLE = SequellaType.from({
  nom: 'Siège irrécupérable',
  nom_interne: 'siege_irrecuperable',
  description: "Valeur d'Équipage réduite de 1 (minimum 1).",
  chocs_cost: 0,
});

// ── Décorateurs concrets ──────────────────────────────────────────────────────

/** Moteur endommagé : vitesse maximale réduite de 1. */
export class MoteurEndommageDecorator extends SequellaDecorator {
  constructor(inner: VehicleBuild) {
    super(inner, SEQUELLA_MOTEUR_ENDOMMAGE);
  }

  override get stats(): VehicleStats {
    const s = this.inner.stats;
    return { ...s, vitesse_max: Math.max(1, s.vitesse_max - 1) };
  }
}

/** Direction endommagée : manoeuvrabilité réduite de 1 (minimum 1). */
export class DirectionEndommageDecorator extends SequellaDecorator {
  constructor(inner: VehicleBuild) {
    super(inner, SEQUELLA_DIRECTION_ENDOMMAGE);
  }

  override get stats(): VehicleStats {
    const s = this.inner.stats;
    return { ...s, manoeuvrabilite: Math.max(1, s.manoeuvrabilite - 1) };
  }
}

/** Blindage arraché : carrosserie réduite de 2 (minimum 0). */
export class BlindageArrachéDecorator extends SequellaDecorator {
  constructor(inner: VehicleBuild) {
    super(inner, SEQUELLA_BLINDAGE_ARRACHE);
  }

  override get stats(): VehicleStats {
    const s = this.inner.stats;
    return { ...s, carrosserie: Math.max(0, s.carrosserie - 2) };
  }
}

/** Siège irrécupérable : Équipage réduit de 1 (minimum 1). */
export class SiegeIrrecuperableDecorator extends SequellaDecorator {
  constructor(inner: VehicleBuild) {
    super(inner, SEQUELLA_SIEGE_IRRECUPERABLE);
  }

  override get stats(): VehicleStats {
    const s = this.inner.stats;
    return { ...s, equipage: Math.max(1, s.equipage - 1) };
  }
}

// ── Registre ──────────────────────────────────────────────────────────────────

export type SequellaFactory = (inner: VehicleBuild) => SequellaDecorator;

/**
 * Mappe chaque `nom_interne` de séquelle vers :
 * - `type` : le `SequellaType` Value Object (stocké dans `Vehicle.sequellas` au replay)
 * - `factory` : la factory de décorateur (utilisée par `VehicleBuildFactory` en Partie 5
 *   pour assembler la chaîne lors du calcul des stats en atelier)
 *
 * Usage : `SEQUELLA_REGISTRY.get(nomInterne)?.factory(currentBuild)`
 */
export const SEQUELLA_REGISTRY = new Map<string, { type: SequellaType; factory: SequellaFactory }>([
  ['moteur_endommage', { type: SEQUELLA_MOTEUR_ENDOMMAGE, factory: (inner) => new MoteurEndommageDecorator(inner) }],
  ['direction_endommage', { type: SEQUELLA_DIRECTION_ENDOMMAGE, factory: (inner) => new DirectionEndommageDecorator(inner) }],
  ['blindage_arrache', { type: SEQUELLA_BLINDAGE_ARRACHE, factory: (inner) => new BlindageArrachéDecorator(inner) }],
  ['siege_irrecuperable', { type: SEQUELLA_SIEGE_IRRECUPERABLE, factory: (inner) => new SiegeIrrecuperableDecorator(inner) }],
]);
