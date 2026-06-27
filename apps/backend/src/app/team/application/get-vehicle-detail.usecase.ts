import type { ITeamRepository } from '../domain/team.repository.interface';
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
 * Charge l'agrégat Team pour accéder au Vehicle ciblé, puis délègue au VehicleBuildFactory
 * pour construire la chaîne de décorateurs qui calcule les statistiques dérivées.
 */
export class GetVehicleDetailUseCase {
  constructor(
    private readonly teamRepo: ITeamRepository,
    private readonly catalogRepo: ICatalogRepository,
    private readonly buildFactory: VehicleBuildFactory,
  ) {}

  @LogUseCase()
  async execute(query: GetVehicleDetailQuery): Promise<VehicleDetailDto> {
    const team = await this.teamRepo.findByVehicleId(query.vehicleId, query.userId);
    const vehicle = team.findVehicle(query.vehicleId);

    const catalogVehicule = this.catalogRepo.getVehicleType(vehicle.type.nomInterne);
    if (!catalogVehicule) {
      throw new Error(`Véhicule catalogue inconnu : "${vehicle.type.nomInterne}" (véhicule #${vehicle.id})`);
    }

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
