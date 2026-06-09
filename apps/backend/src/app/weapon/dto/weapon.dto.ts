/**
 * DTO de réponse pour une arme montée sur un véhicule.
 *
 * Symétrie avec `VehicleImprovementDto` (cf. son en-tête) : objet plain sérialisable,
 * enrichi par `VehicleService.toVehicleDto` avec le `prix` lu via le getter de l'entité.
 * Pas de `estDefaut` : les armes n'ont pas de notion d'équipement par défaut.
 */
import type { Orientation } from '../../vehicle/vehicle-build';

export interface WeaponDto {
  id: number;
  nomInterne: string;
  orientation: Orientation | null;
  vehicleId: number;
  createdAt: Date;
  /** Prix de l'arme en Jerricans, lu depuis le catalogue au moment du chargement. */
  prix: number;
}
