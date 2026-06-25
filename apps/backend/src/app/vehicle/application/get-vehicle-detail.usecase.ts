import type { IVehicleRepository } from '../domain/vehicle.repository.interface';
import type { ICatalogRepository } from '../domain/catalog.repository.interface';
import type { VehicleDetailDto } from '../dto/vehicle-detail.dto';
import type { VehicleBuildFactory } from '../vehicle-build.factory';
import { LogUseCase } from '../log-use-case.decorator';

export interface GetVehicleDetailQuery {
  vehicleId: number;
  userId: number;
}

/**
 * Retourne le détail "monté" d'un véhicule (stats accumulées via le Pattern Decorator).
 *
 * Le Pattern Decorator (VehicleBuild) calcule les statistiques dérivées des
 * améliorations (carrosserie, manoeuvrabilité, etc.) — il s'agit d'une couche
 * de présentation, distincte des règles métier portées par l'agrégat Vehicle.
 * Ce use case orchestre les deux : chargement de l'agrégat → construction de la
 * chaîne → production du DTO de présentation.
 *
 * Remplace VehicleController.getOne() qui appelait directement VehicleService.
 */
export class GetVehicleDetailUseCase {
  constructor(
    private readonly vehicleRepo: IVehicleRepository,
    private readonly catalogRepo: ICatalogRepository,
    private readonly buildFactory: VehicleBuildFactory,
  ) {}

  @LogUseCase()
  async execute(query: GetVehicleDetailQuery): Promise<VehicleDetailDto> {
    const vehicle = await this.vehicleRepo.findByIdForUser(query.vehicleId, query.userId);

    const catalogVehicule = this.catalogRepo.getVehicleType(vehicle.type.nomInterne);
    if (!catalogVehicule) {
      throw new Error(`Véhicule catalogue inconnu : "${vehicle.type.nomInterne}" (véhicule #${vehicle.id})`);
    }

    // Reconstitue la chaîne VehicleBuild depuis l'agrégat domaine
    const installed = vehicle.improvements
      .filter((i) => !i.estDefaut)
      .map((i) => ({
        nom_interne: i.type.nomInterne,
        orientation: i.orientation ?? undefined,
      }));

    const build = this.buildFactory.create(catalogVehicule.toRaw(), installed);

    return {
      id: vehicle.id,
      nomInterne: vehicle.type.nomInterne,
      stats: build.stats,
      baseStats: build.baseStats,
      recapitulatif: build.describe(),
    };
  }
}
