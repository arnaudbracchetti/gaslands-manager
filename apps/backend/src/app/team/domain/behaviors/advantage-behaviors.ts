import { fail, ok } from '../team';
import {
  EquipmentBehaviorBase,
  NEUTRAL_EQUIPMENT_BEHAVIOR,
  type EquipmentBehavior,
  type PlacementContext,
  type RuleResult,
  type VehicleStats,
} from './equipment-behavior';

class ExpertiseBehavior extends EquipmentBehaviorBase {
  override applyStats(current: VehicleStats): VehicleStats {
    return { ...current, manoeuvrabilite: current.manoeuvrabilite + 1 };
  }
}

class CascadeurBehavior extends EquipmentBehaviorBase {
  override canPlace(ctx: PlacementContext): RuleResult {
    if (ctx.baseStats.poids === 'Lourd') {
      return fail('Cascadeur est réservé aux véhicules de Poids Léger ou Moyen');
    }
    // Cascadeur n'a pas d'effet propre (applyStats hérité = identité) : `projete` égale
    // `ctx.currentStats`, c'est-à-dire tout ce qui est déjà monté EN DESSOUS (améliorations
    // + avantages précédents), sans jamais inclure le candidat lui-même.
    const projete = this.applyStats(ctx.currentStats);
    if (projete.manoeuvrabilite < 3) {
      return fail("Cascadeur nécessite une Manœuvrabilité effective d'au moins 3");
    }
    return ok();
  }
}

class SurDeuxRouesBehavior extends EquipmentBehaviorBase {
  override canPlace(ctx: PlacementContext): RuleResult {
    if (ctx.currentStats.manoeuvrabilite < 3) {
      return fail("Sur Deux Roues nécessite une Manœuvrabilité effective d'au moins 3");
    }
    return ok();
  }
}

export const ADVANTAGE_BEHAVIORS: Readonly<Record<string, EquipmentBehavior>> = {
  expertise: new ExpertiseBehavior(),
  cascadeur: new CascadeurBehavior(),
  sur_deux_roues: new SurDeuxRouesBehavior(),
};

export function resolveAdvantageBehavior(comportement: string | undefined): EquipmentBehavior {
  return ADVANTAGE_BEHAVIORS[comportement ?? ''] ?? NEUTRAL_EQUIPMENT_BEHAVIOR;
}
