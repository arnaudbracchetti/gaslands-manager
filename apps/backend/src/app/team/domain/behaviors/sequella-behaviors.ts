import type { VehicleStats } from './equipment-behavior';

/**
 * Contrat des séquelles — SEULEMENT `applyStats`, pas de `canPlace` : contrairement aux
 * améliorations/avantages, une séquelle n'est JAMAIS validée via ce mécanisme.
 * `Vehicle.canAddSequella()` garde seul l'origine/l'unicité/les Chocs, sans jamais
 * invoquer une Strategy — une interface plus étroite documente cet invariant du domaine
 * plutôt que de le cacher derrière une méthode qui existerait mais ne serait jamais
 * appelée.
 */
export interface SequellaBehavior {
  applyStats(current: VehicleStats): VehicleStats;
}

const NEUTRAL_SEQUELLA_BEHAVIOR: SequellaBehavior = { applyStats: (s) => s };

class SiegeIrrecuperableBehavior implements SequellaBehavior {
  applyStats(current: VehicleStats): VehicleStats {
    return { ...current, equipage: Math.max(1, current.equipage - 1) };
  }
}

/** Clé = `nom_interne` de la séquelle (pas de champ `comportement` sur `Sequelle`). */
export const SEQUELLA_BEHAVIORS: ReadonlyMap<string, SequellaBehavior> = new Map([
  ['siege_irrecuperable', new SiegeIrrecuperableBehavior()],
]);

export function resolveSequellaBehavior(nomInterne: string): SequellaBehavior {
  return SEQUELLA_BEHAVIORS.get(nomInterne) ?? NEUTRAL_SEQUELLA_BEHAVIOR;
}
