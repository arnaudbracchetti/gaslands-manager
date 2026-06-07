/**
 * VehicleBuildFactory — assemble la chaîne `VehicleBuild` représentant un véhicule
 * "monté" : le profil catalogue, enveloppé d'une couche par amélioration installée.
 *
 * Cette factory est le SEUL endroit qui sache comment reconstituer une chaîne à
 * partir de données persistées (`Vehicle` + ses `VehicleImprovement`). Le reste du
 * système (service, contrôleur) manipule uniquement le résultat — un `VehicleBuild`
 * — sans jamais avoir à savoir comment il a été construit ni combien de couches il
 * contient (cf. Pattern Decorator, `vehicle-build.ts`).
 *
 * Pourquoi un objet séparé de `ImprovementDecoratorFactory` ? Deux responsabilités
 * distinctes : celle-ci sait QUEL DÉCORATEUR choisir pour UNE amélioration ; celle-là
 * sait COMMENT EMPILER plusieurs améliorations dans le bon ordre, en résolvant
 * chacune depuis le catalogue. Les séparer évite à chacune de porter une
 * responsabilité qui n'est pas la sienne — exactement l'esprit Single Responsibility
 * qui sous-tend déjà la séparation `CatalogService` / reste de l'application.
 */

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

  /**
   * Construit la chaîne complète : `CatalogVehicleBuild` à la base, puis une couche
   * `ImprovementDecorator` par amélioration de `improvements`, DANS L'ORDRE FOURNI —
   * l'ordre de pose n'a pas d'incidence sur les règles actuelles (chacune ne valide
   * QUE sa propre cohérence, jamais une notion de séquence), mais le préserver reste
   * la position la plus simple à justifier : c'est l'ordre réel d'achat du joueur,
   * et `describe()` l'restitue tel quel dans le récapitulatif.
   *
   * `improvements` accepte aussi bien des entités persistées (`VehicleImprovement`,
   * qui exposent `nom_interne`/`orientation`) qu'une liste hypothétique construite
   * pour une vérification à blanc — `InstalledImprovement` est leur plus petit
   * dénominateur commun (cf. `canAddImprovement`, `vehicle.service.ts`).
   */
  create(catalogVehicule: Vehicule, improvements: readonly InstalledImprovement[]): VehicleBuild {
    let build: VehicleBuild = new CatalogVehicleBuild(catalogVehicule);

    for (const installed of improvements) {
      const amelioration = this.catalogService.getAmeliorationByNomInterne(installed.nom_interne);
      if (!amelioration) {
        // Une amélioration persistée qui ne correspond plus à aucune entrée catalogue
        // est une incohérence de données (catalogue modifié après coup, corruption...) —
        // pas une erreur utilisateur. On échoue tôt et bruyamment, plutôt que de
        // construire silencieusement une chaîne incomplète qui fausserait stats/validate.
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
