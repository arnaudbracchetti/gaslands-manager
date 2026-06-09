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
   * Prix effectif en Jerricans — toujours un `number` réel :
   * - `0` pour les améliorations par défaut (`estDefaut`).
   * - Pour la Tourelle : 3× le prix catalogue de l'arme assignée, ou `0` si orpheline.
   * - Autres améliorations : prix catalogue direct.
   * (cf. `VehicleImprovement.prix` — corrige l'ancien retour `"x3"` string)
   */
  prix: number;
  /**
   * Emplacements consommés — `0` pour les améliorations par défaut,
   * valeur catalogue pour les autres (cf. `VehicleImprovement.emplacement`).
   * Le frontend consomme ce champ directement, sans consulter le catalogue.
   */
  emplacement: number;
  /**
   * Nom interne de l'arme montée sur cette Tourelle (`nomInterne === 'tourelle'`),
   * ou `null` si aucune arme n'est assignée (état orphelin) ou pour toute autre
   * amélioration. Le frontend utilise ce champ pour fusionner l'affichage
   * "Arme (Tourelle)" en une seule ligne dans l'équipement actuel.
   */
  weaponNomInterne: string | null;
}
