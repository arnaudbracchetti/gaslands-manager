import { Injectable } from '@nestjs/common';
import { CatalogService } from '../../catalog/catalog.service';
import type { ICatalogRepository } from '../domain/catalog.repository.interface';
import type { VehicleType } from '../domain/value-objects/vehicle-type';
import type { WeaponType } from '../domain/value-objects/weapon-type';
import type { ImprovementType } from '../domain/value-objects/improvement-type';
import type { AdvantageType } from '../domain/value-objects/advantage-type';

/**
 * CatalogAdapter — implémentation de ICatalogRepository pour le module Team.
 *
 * Pont entre le domaine Team (qui définit ICatalogRepository) et CatalogService
 * (classe d'infrastructure NestJS qui charge les YAML).
 */
@Injectable()
export class CatalogAdapter implements ICatalogRepository {
  constructor(private readonly catalogService: CatalogService) {}

  getVehicleType(nomInterne: string): VehicleType | undefined {
    return this.catalogService.getVehicleType(nomInterne);
  }

  getWeaponType(nomInterne: string): WeaponType | undefined {
    return this.catalogService.getWeaponType(nomInterne);
  }

  getImprovementType(nomInterne: string): ImprovementType | undefined {
    return this.catalogService.getImprovementType(nomInterne);
  }

  getAdvantageType(nomInterne: string): AdvantageType | undefined {
    return this.catalogService.getAdvantageType(nomInterne);
  }

  getVehicleTypesForSponsor(sponsorNom: string): VehicleType[] {
    return this.catalogService.getVehicleTypesForSponsor(sponsorNom);
  }

  getWeaponTypesForSponsor(sponsorNom: string): WeaponType[] {
    return this.catalogService.getWeaponTypesForSponsor(sponsorNom);
  }

  getImprovementTypesForSponsor(sponsorNom: string): ImprovementType[] {
    return this.catalogService.getImprovementTypesForSponsor(sponsorNom);
  }

  getAdvantageTypesForSponsor(sponsorNom: string): AdvantageType[] {
    return this.catalogService.getAdvantageTypesForSponsor(sponsorNom);
  }
}
