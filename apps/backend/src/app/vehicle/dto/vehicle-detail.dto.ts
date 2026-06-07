/**
 * DTO de réponse pour `GET /api/vehicles/:id` — l'état "monté" d'un véhicule.
 *
 * On expose le RÉSULTAT de la chaîne `VehicleBuild` (profil accumulé, profil
 * d'origine, récapitulatif des couches) — jamais la chaîne elle-même : le client
 * HTTP n'a pas à connaître le Pattern Decorator, seulement ce qu'il calcule. Même
 * logique de séparation que `TeamResponseDto` (l'API expose une FORME pensée pour
 * le client, pas la structure interne qui la produit).
 */
import type { VehicleStats, VehicleStatsSummary } from '../vehicle-build';

export interface VehicleDetailDto {
  id: number;
  /** Référence catalogue du véhicule (cf. `Vehicle.nomInterne`). */
  nomInterne: string;
  /** Profil actuel — accumulation des effets de toutes les améliorations posées. */
  stats: VehicleStats;
  /** Profil d'origine, avant toute amélioration — sert de référence à l'affichage des écarts. */
  baseStats: VehicleStats;
  /** Une ligne par couche, du véhicule de base à la dernière amélioration posée. */
  recapitulatif: VehicleStatsSummary[];
}
