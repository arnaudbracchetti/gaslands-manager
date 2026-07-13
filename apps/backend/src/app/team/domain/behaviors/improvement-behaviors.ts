import { fail, ok } from '../team';
import {
  EquipmentBehaviorBase,
  NEUTRAL_EQUIPMENT_BEHAVIOR,
  type EquipmentBehavior,
  type PlacementCandidate,
  type PlacementContext,
  type RuleResult,
  type VehicleStats,
} from './equipment-behavior';

class ChenillesBehavior extends EquipmentBehaviorBase {
  private static readonly VEHICULES_INCOMPATIBLES: readonly string[] = [
    'char_assaut',
    'helicoptere',
    'gyrocoptere',
  ];

  override applyStats(current: VehicleStats): VehicleStats {
    return { ...current, vitesse_max: current.vitesse_max - 1, manoeuvrabilite: current.manoeuvrabilite + 1 };
  }

  override canPlace(ctx: PlacementContext): RuleResult {
    if (ChenillesBehavior.VEHICULES_INCOMPATIBLES.includes(ctx.baseStats.nom_interne)) {
      return fail('Chenilles incompatibles avec ce véhicule');
    }
    if (ctx.installedCount >= 1) {
      return fail('Une seule paire de Chenilles par véhicule');
    }
    return ok();
  }
}

class MembreEquipageBehavior extends EquipmentBehaviorBase {
  private static readonly MULTIPLICATEUR_MAX = 2;

  override applyStats(current: VehicleStats): VehicleStats {
    return { ...current, equipage: current.equipage + 1 };
  }

  override canPlace(ctx: PlacementContext): RuleResult {
    const seuil = ctx.baseStats.equipage * MembreEquipageBehavior.MULTIPLICATEUR_MAX;
    // Le candidat s'applique lui-même AVANT le test : préserve exactement la nuance
    // "seuil sur le catalogue brut (baseStats), valeur testée incluant le candidat".
    const projete = this.applyStats(ctx.currentStats);
    if (projete.equipage > seuil) {
      return fail(`Maximum d'équipage atteint (${seuil})`);
    }
    return ok();
  }
}

class BelierBehavior extends EquipmentBehaviorBase {
  override canPlace(ctx: PlacementContext, candidate: PlacementCandidate): RuleResult {
    if (candidate.orientation && ctx.hasOrientation(candidate.orientation)) {
      return fail(`Un Bélier occupe déjà la position "${candidate.orientation}"`);
    }
    return ok();
  }
}

class BelierExplosifBehavior extends EquipmentBehaviorBase {
  override canPlace(ctx: PlacementContext): RuleResult {
    if (ctx.baseStats.poids === 'Léger') {
      return fail('Le Bélier Explosif est interdit sur les véhicules de Poids Léger');
    }
    if (ctx.installedCount >= 1) {
      return fail('Un seul Bélier Explosif par véhicule');
    }
    return ok();
  }
}

class BlindageBehavior extends EquipmentBehaviorBase {
  override applyStats(current: VehicleStats): VehicleStats {
    return { ...current, carrosserie: current.carrosserie + 2 };
  }
}

class MishkinExclusifBehavior extends EquipmentBehaviorBase {
  override canPlace(ctx: PlacementContext, candidate: PlacementCandidate): RuleResult {
    if (ctx.installedCount >= 1) {
      return fail(`Un seul exemplaire de "${candidate.nom}" par véhicule`);
    }
    return ok();
  }
}

/**
 * Comportements partagés par toutes les remorques — sert uniquement à la règle
 * transversale "Un véhicule ne peut être équipé que d'une seule remorque" (p.170).
 * `remorque_legere` est incluse par anticipation : elle n'a aujourd'hui aucun
 * `comportement` déclaré au catalogue (hors périmètre — aucun effet numérique
 * documenté au-delà du thème), donc une Remorque Légère déjà montée n'est pas
 * détectée par ce mécanisme tant qu'elle n'a pas de comportement propre. Le jour où
 * elle en recevra un, elle sera automatiquement couverte sans modifier cette liste.
 */
const COMPORTEMENTS_REMORQUE: readonly string[] = ['remorque_legere', 'remorque_moyenne', 'remorque_lourde'];

class RemorqueMoyenneBehavior extends EquipmentBehaviorBase {
  override applyStats(current: VehicleStats): VehicleStats {
    return { ...current, emplacements: current.emplacements + 1 };
  }

  override canPlace(ctx: PlacementContext): RuleResult {
    if (ctx.baseStats.poids === 'Léger') {
      return fail('La Remorque Moyenne est réservée aux véhicules de Poids Moyen ou Lourd');
    }
    if (ctx.hasComportementAmong(COMPORTEMENTS_REMORQUE)) {
      return fail('Un véhicule ne peut être équipé que d\'une seule remorque');
    }
    return ok();
  }
}

class RemorqueLourdeBehavior extends EquipmentBehaviorBase {
  override applyStats(current: VehicleStats): VehicleStats {
    return { ...current, emplacements: current.emplacements + 3 };
  }

  override canPlace(ctx: PlacementContext): RuleResult {
    if (ctx.baseStats.poids !== 'Lourd') {
      return fail('La Remorque Lourde est réservée aux véhicules de Poids Lourd');
    }
    if (ctx.hasComportementAmong(COMPORTEMENTS_REMORQUE)) {
      return fail('Un véhicule ne peut être équipé que d\'une seule remorque');
    }
    return ok();
  }
}

export const IMPROVEMENT_BEHAVIORS: Readonly<Record<string, EquipmentBehavior>> = {
  chenilles: new ChenillesBehavior(),
  membre_equipage: new MembreEquipageBehavior(),
  belier: new BelierBehavior(),
  belier_explosif: new BelierExplosifBehavior(),
  blindage: new BlindageBehavior(),
  mishkin_exclusif: new MishkinExclusifBehavior(),
  remorque_moyenne: new RemorqueMoyenneBehavior(),
  remorque_lourde: new RemorqueLourdeBehavior(),
};

export function resolveImprovementBehavior(comportement: string | undefined): EquipmentBehavior {
  return IMPROVEMENT_BEHAVIORS[comportement ?? ''] ?? NEUTRAL_EQUIPMENT_BEHAVIOR;
}
