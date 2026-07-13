import type { VehicleType } from './value-objects/vehicle-type';
import type { WeaponType } from './value-objects/weapon-type';
import type { ImprovementType } from './value-objects/improvement-type';
import type { AdvantageType } from './value-objects/advantage-type';
import type { SequellaType } from './value-objects/sequella-type';

/**
 * Contrat d'accès au catalogue de jeu depuis la couche domaine de Team.
 *
 * Même rôle qu'ICatalogRepository dans l'ancien VehicleModule, mais importé depuis
 * team/domain/ pour respecter la Dependency Inversion : le domaine Team définit
 * ses propres contrats, l'infrastructure les implémente.
 */
export interface ICatalogRepository {
  getVehicleType(nomInterne: string): VehicleType | undefined;
  getWeaponType(nomInterne: string): WeaponType | undefined;
  getImprovementType(nomInterne: string): ImprovementType | undefined;
  getAdvantageType(nomInterne: string): AdvantageType | undefined;
  /** Séquelle catalogue par son nom_interne — jamais scopée par sponsor (cf. `Sequelle`). */
  getSequellaType(nomInterne: string): SequellaType | undefined;
  getVehicleTypesForSponsor(sponsorNom: string): VehicleType[];
  getWeaponTypesForSponsor(sponsorNom: string): WeaponType[];
  getImprovementTypesForSponsor(sponsorNom: string): ImprovementType[];
  getAdvantageTypesForSponsor(sponsorNom: string): AdvantageType[];
}
