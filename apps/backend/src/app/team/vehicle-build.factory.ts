import { Injectable } from '@nestjs/common';
import type { Vehicule } from '../catalog/catalog.interfaces';
import { CatalogService } from '../catalog/catalog.service';
import { ImprovementDecoratorFactory } from './domain/improvement-decorator.factory';
import { AdvantageDecoratorFactory } from './domain/advantage-decorator.factory';
import { SequellaDecoratorFactory } from './domain/sequella-decorators';
import { SequellaType } from './domain/value-objects/sequella-type';
import { CatalogVehicleBuild, type InstalledImprovement, type VehicleBuild } from './domain/vehicle-build';

@Injectable()
export class VehicleBuildFactory {
  constructor(private readonly catalogService: CatalogService) {}

  create(
    catalogVehicule: Vehicule,
    improvements: readonly InstalledImprovement[],
    advantages: readonly InstalledImprovement[] = [],
    sequellas: readonly InstalledImprovement[] = [],
  ): VehicleBuild {
    let build: VehicleBuild = new CatalogVehicleBuild(catalogVehicule);

    // Ordre de pliage identique à `Vehicle.buildChain` : base → séquelles → améliorations
    // → avantages (dommages permanents avant les bonus d'équipement).
    for (const installed of sequellas) {
      const sequelle = this.catalogService.getSequelleByNomInterne(installed.nom_interne);
      if (!sequelle) {
        throw new Error(
          `Séquelle inconnue du catalogue : "${installed.nom_interne}" ` +
            `(sur le véhicule "${catalogVehicule.nom}")`,
        );
      }
      build = SequellaDecoratorFactory.wrap(build, SequellaType.from(sequelle), installed);
    }

    for (const installed of improvements) {
      const amelioration = this.catalogService.getAmeliorationByNomInterne(installed.nom_interne);
      if (!amelioration) {
        throw new Error(
          `Amélioration inconnue du catalogue : "${installed.nom_interne}" ` +
            `(installée sur le véhicule "${catalogVehicule.nom}")`,
        );
      }
      build = ImprovementDecoratorFactory.wrap(build, amelioration, installed);
    }

    for (const installed of advantages) {
      const avantage = this.catalogService.getAvantageByNomInterne(installed.nom_interne);
      if (!avantage) {
        throw new Error(
          `Avantage inconnu du catalogue : "${installed.nom_interne}" ` +
            `(installé sur le véhicule "${catalogVehicule.nom}")`,
        );
      }
      build = AdvantageDecoratorFactory.wrap(build, avantage, installed);
    }

    return build;
  }
}
