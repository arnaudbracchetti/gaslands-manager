import { Injectable } from '@nestjs/common';
import type { Vehicule } from '../catalog/catalog.interfaces';
import { CatalogService } from '../catalog/catalog.service';
import { ImprovementDecoratorFactory } from './improvement-decorator.factory';
import { CatalogVehicleBuild, type InstalledImprovement, type VehicleBuild } from './vehicle-build';

@Injectable()
export class VehicleBuildFactory {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly decoratorFactory: ImprovementDecoratorFactory,
  ) {}

  create(catalogVehicule: Vehicule, improvements: readonly InstalledImprovement[]): VehicleBuild {
    let build: VehicleBuild = new CatalogVehicleBuild(catalogVehicule);

    for (const installed of improvements) {
      const amelioration = this.catalogService.getAmeliorationByNomInterne(installed.nom_interne);
      if (!amelioration) {
        throw new Error(
          `Amélioration inconnue du catalogue : "${installed.nom_interne}" ` +
            `(installée sur le véhicule "${catalogVehicule.nom}")`,
        );
      }
      build = this.decoratorFactory.wrap(build, amelioration, installed);
    }

    return build;
  }
}
