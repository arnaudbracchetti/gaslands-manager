import type { ITeamRepository } from '../domain/team.repository.interface';
import type { ICatalogRepository } from '../domain/catalog.repository.interface';
import type { VehicleType } from '../domain/value-objects/vehicle-type';
import type { AvailableVehicleDto } from '../dto/available-vehicle.dto';
import { LogUseCase } from '../log-use-case.decorator';

export interface GetAvailableVehiclesQuery {
  teamId: number;
  userId: number;
}

/**
 * Retourne, pour chaque véhicule du catalogue autorisé par le sponsor de l'équipe,
 * un verdict de disponibilité budgétaire (`disponible`/`raison`).
 *
 * Mirroir de `GetAvailableWeaponsUseCase`, mais porté par `Team` directement
 * (`Team.canAddVehicle`) plutôt que par un `Vehicle` déjà chargé : aucune entité
 * véhicule n'existe encore avant cet achat.
 */
export class GetAvailableVehiclesUseCase {
  constructor(
    private readonly teamRepo: ITeamRepository,
    private readonly catalogRepo: ICatalogRepository,
  ) {}

  @LogUseCase()
  async execute(query: GetAvailableVehiclesQuery): Promise<AvailableVehicleDto[]> {
    const team = await this.teamRepo.findByIdForUser(query.teamId, query.userId);
    const vehicleTypes = this.catalogRepo.getVehicleTypesForSponsor(team.sponsor);
    const budget = team.remainingBudget;

    return vehicleTypes.map((vt: VehicleType): AvailableVehicleDto => {
      const result = team.canAddVehicle(vt, budget);
      return {
        nomInterne: vt.nomInterne,
        disponible: result.ok,
        raison: result.ok ? undefined : result.reason,
      };
    });
  }
}
