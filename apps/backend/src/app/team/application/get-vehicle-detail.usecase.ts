import type { ITeamRepository } from '../domain/team.repository.interface';
import type { VehicleDetailDto } from '../dto/vehicle-detail.dto';
import { LogUseCase } from '../log-use-case.decorator';

export interface GetVehicleDetailQuery {
  vehicleId: number;
  userId: number;
}

/**
 * Retourne le détail "monté" d'un véhicule (stats effectives + récapitulatif).
 *
 * Charge l'agrégat Team pour accéder au Vehicle ciblé — `vehicle.effectiveStats`/
 * `baseStats`/`describe()` calculent tout directement sur l'agrégat (Strategy GoF,
 * cf. `domain/behaviors/`), plus besoin de résoudre le catalogue séparément.
 */
export class GetVehicleDetailUseCase {
  constructor(private readonly teamRepo: ITeamRepository) {}

  @LogUseCase()
  async execute(query: GetVehicleDetailQuery): Promise<VehicleDetailDto> {
    const team = await this.teamRepo.findByVehicleId(query.vehicleId, query.userId);
    const vehicle = team.findVehicle(query.vehicleId);

    return {
      id: vehicle.id,
      nomInterne: vehicle.type.nomInterne,
      stats: vehicle.effectiveStats,
      baseStats: vehicle.baseStats,
      recapitulatif: vehicle.describe(),
    };
  }
}
