/**
 * CatalogAdapter — implémentation de ICatalogRepository via CatalogService.
 *
 * Séparation d'interface (Dependency Inversion) : les use cases et l'agrégat Vehicle
 * dépendent de ICatalogRepository (interface du domaine), jamais de CatalogService
 * (classe d'infrastructure). CatalogAdapter est le pont entre les deux.
 *
 * En production, NestJS injecte cet adapter sous le token CATALOG_REPOSITORY.
 * En test, les specs fournissent un mock de ICatalogRepository directement.
 */
import { Injectable } from '@nestjs/common';
import { CatalogService } from '../../catalog/catalog.service';
import type { ICatalogRepository } from '../domain/catalog.repository.interface';
import type { VehicleType } from '../domain/value-objects/vehicle-type';
import type { WeaponType } from '../domain/value-objects/weapon-type';
import type { ImprovementType } from '../domain/value-objects/improvement-type';

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

  getVehicleTypesForSponsor(sponsorNom: string): VehicleType[] {
    return this.catalogService.getVehicleTypesForSponsor(sponsorNom);
  }

  getWeaponTypesForSponsor(sponsorNom: string): WeaponType[] {
    return this.catalogService.getWeaponTypesForSponsor(sponsorNom);
  }

  getImprovementTypesForSponsor(sponsorNom: string): ImprovementType[] {
    return this.catalogService.getImprovementTypesForSponsor(sponsorNom);
  }
}
