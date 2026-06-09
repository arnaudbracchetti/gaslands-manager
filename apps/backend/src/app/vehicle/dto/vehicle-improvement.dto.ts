/**
 * DTO de réponse pour une amélioration installée sur un véhicule.
 *
 * Miroir sérialisable de l'entité `VehicleImprovement` enrichie par le service
 * (cf. `VehicleService.toVehicleDto` et `VehicleImprovement.prix`). Les getters
 * TypeScript ne sont pas sérialisés par `JSON.stringify` — ce DTO est l'objet
 * plain qui voyage réellement dans la réponse HTTP.
 */
import type { Orientation } from '../vehicle-build';

export interface VehicleImprovementDto {
  id: number;
  nomInterne: string;
  orientation: Orientation | null;
  vehicleId: number;
  createdAt: Date;
  /** `true` si l'amélioration fait partie du profil de base du véhicule (coût zéro, non supprimable). */
  estDefaut: boolean;
  /**
   * Prix effectif en Jerricans — `0` pour les améliorations par défaut,
   * prix catalogue pour les autres (cf. `VehicleImprovement.prix`).
   */
  prix: number;
  /**
   * Emplacements consommés — `0` pour les améliorations par défaut,
   * valeur catalogue pour les autres (cf. `VehicleImprovement.emplacement`).
   * Le frontend consomme ce champ directement, sans consulter le catalogue.
   */
  emplacement: number;
}
