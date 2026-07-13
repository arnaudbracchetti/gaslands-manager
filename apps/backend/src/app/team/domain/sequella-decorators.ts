/**
 * Décorateurs de séquelles campagne Gaslands.
 *
 * Pattern GoF Decorator — même infrastructure que `improvement-decorators.ts`.
 * Les séquelles étendent `ImprovementDecorator` et modifient les stats du véhicule
 * de façon permanente (dommages de campagne, non persistés — reconstruits au replay).
 *
 * Chaque séquelle est identifiée par un `SequellaType` (Value Object résolu depuis le
 * catalogue `sequelle.yml` via `CatalogService`, même modèle que `WeaponType` /
 * `ImprovementType`). `Vehicle.addCampaignSequella(type, campaignId)` stocke le Value
 * Object ; `Vehicle.buildChain()` / `VehicleBuildFactory` plient ensuite ces décorateurs
 * dans la chaîne (via `SequellaDecoratorFactory.wrap` ci-dessous) pour que leurs effets
 * de stat s'appliquent aux stats effectives du véhicule — au même titre que les
 * améliorations et les avantages.
 *
 * Différences avec ImprovementDecorator ordinaire :
 * - `emplacement: 0`  — les séquelles ne consomment pas d'emplacement
 * - `validate()` délègue directement à `inner` — la validation se fait au
 *   write-time (`Vehicle.canAddSequella`), jamais au replay
 */

import {
  ImprovementDecorator,
  type InstalledImprovement,
  type VehicleBuild,
  type VehicleStats,
} from './vehicle-build';
import type { SequellaType } from './value-objects/sequella-type';
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
      necessite_orientation: false,
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

// ── Décorateurs concrets ──────────────────────────────────────────────────────
// Le SequellaType (nom, description, coût) vient désormais du catalogue
// (`sequelle.yml` via CatalogService), passé en paramètre plutôt que codé en dur.

/** Moteur endommagé : vitesse maximale réduite de 1. */
export class MoteurEndommageDecorator extends SequellaDecorator {
  constructor(inner: VehicleBuild, sequellaType: SequellaType) {
    super(inner, sequellaType);
  }

  override get stats(): VehicleStats {
    const s = this.inner.stats;
    return { ...s, vitesse_max: Math.max(1, s.vitesse_max - 1) };
  }
}

/** Direction endommagée : manoeuvrabilité réduite de 1 (minimum 1). */
export class DirectionEndommageDecorator extends SequellaDecorator {
  constructor(inner: VehicleBuild, sequellaType: SequellaType) {
    super(inner, sequellaType);
  }

  override get stats(): VehicleStats {
    const s = this.inner.stats;
    return { ...s, manoeuvrabilite: Math.max(1, s.manoeuvrabilite - 1) };
  }
}

/** Blindage arraché : carrosserie réduite de 2 (minimum 0). */
export class BlindageArrachéDecorator extends SequellaDecorator {
  constructor(inner: VehicleBuild, sequellaType: SequellaType) {
    super(inner, sequellaType);
  }

  override get stats(): VehicleStats {
    const s = this.inner.stats;
    return { ...s, carrosserie: Math.max(0, s.carrosserie - 2) };
  }
}

/** Siège irrécupérable : Équipage réduit de 1 (minimum 1). */
export class SiegeIrrecuperableDecorator extends SequellaDecorator {
  constructor(inner: VehicleBuild, sequellaType: SequellaType) {
    super(inner, sequellaType);
  }

  override get stats(): VehicleStats {
    const s = this.inner.stats;
    return { ...s, equipage: Math.max(1, s.equipage - 1) };
  }
}

// ── Décorateur neutre : séquelle sans effet chiffré ───────────────────────────

/**
 * Décorateur "par défaut" pour toute séquelle sans effet sur le profil chiffré (les 11
 * séquelles `ATELIER` comportementales : Suicidaire, Impopulaire… — effet narratif ou
 * de jeu, aucune stat modifiée). Mirroir de `NeutralDecorator`/`NeutralAdvantageDecorator`,
 * corps vide intentionnel. Utilisé aussi pour neutraliser une séquelle vendue.
 */
export class NeutralSequellaDecorator extends SequellaDecorator {}

// ── Registre de factories + fabrique ──────────────────────────────────────────

export type SequellaFactory = (inner: VehicleBuild, sequellaType: SequellaType) => SequellaDecorator;

/**
 * Mappe chaque `nom_interne` de séquelle à effet chiffré vers sa factory de décorateur.
 * Les 4 séquelles imposées par la Table des Épaves modifient une stat ; les 11 autres
 * n'en modifient aucune (repli sur `NeutralSequellaDecorator`, cf. `SequellaDecoratorFactory`).
 */
export const SEQUELLA_DECORATOR_FACTORIES: ReadonlyMap<string, SequellaFactory> = new Map([
  ['moteur_endommage', (inner: VehicleBuild, type: SequellaType): SequellaDecorator => new MoteurEndommageDecorator(inner, type)],
  ['direction_endommage', (inner: VehicleBuild, type: SequellaType): SequellaDecorator => new DirectionEndommageDecorator(inner, type)],
  ['blindage_arrache', (inner: VehicleBuild, type: SequellaType): SequellaDecorator => new BlindageArrachéDecorator(inner, type)],
  ['siege_irrecuperable', (inner: VehicleBuild, type: SequellaType): SequellaDecorator => new SiegeIrrecuperableDecorator(inner, type)],
]);

/**
 * Fabrique pure (mirroir d'`ImprovementDecoratorFactory`/`AdvantageDecoratorFactory`) :
 * plie une séquelle dans la chaîne. Une séquelle vendue/perdue est neutralisée (aucun
 * effet), une séquelle à effet chiffré prend son décorateur dédié, et toute autre tombe
 * sur `NeutralSequellaDecorator`. Les séquelles ne consomment jamais d'emplacement
 * (`emplacement: 0`) ni ne portent de règle de pose (`validate()` délègue), quel que
 * soit le décorateur retenu.
 */
export class SequellaDecoratorFactory {
  static wrap(inner: VehicleBuild, sequellaType: SequellaType, instance: InstalledImprovement): VehicleBuild {
    if (instance.isSold || instance.isLost) {
      return new NeutralSequellaDecorator(inner, sequellaType);
    }
    const factory = SEQUELLA_DECORATOR_FACTORIES.get(sequellaType.nomInterne);
    return factory ? factory(inner, sequellaType) : new NeutralSequellaDecorator(inner, sequellaType);
  }
}
