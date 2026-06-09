/**
 * DTO de réponse pour un véhicule d'équipe avec son équipement enrichi.
 *
 * Remplace l'entité brute `Vehicle` dans les réponses HTTP des contrôleurs
 * (`VehicleTeamController`, `VehicleController`, `WeaponController`). Les
 * entités TypeORM ne sérialisent pas les getters (`prix`, cf. les entités) —
 * ce DTO est l'objet plain qui voyage réellement dans la réponse.
 *
 * Construit par `VehicleService.toVehicleDto(vehicle)` après hydratation des
 * propriétés transientes (`ameliorationCatalogue`, `armeCatalogue`).
 */
import type { VehicleImprovementDto } from './vehicle-improvement.dto';
import type { WeaponDto } from '../../weapon/dto/weapon.dto';

export interface VehicleDto {
  id: number;
  nomInterne: string;
  teamId: number;
  createdAt: Date;
  /** Améliorations installées avec leur prix effectif et leur statut défaut. */
  improvements: VehicleImprovementDto[];
  /** Armes montées avec leur prix catalogue. */
  weapons: WeaponDto[];
}
