import { BadRequestException } from '@nestjs/common';
import type { ITeamRepository } from '../domain/team.repository.interface';
import type { Vehicle } from '../domain/vehicle';
import { DomainException } from '../domain/team';
import { LogUseCase } from '../log-use-case.decorator';

export interface RemoveAdvantageCommand {
  vehicleId: number;
  advantageId: number;
  userId: number;
}

/**
 * Retire un avantage acquis d'un véhicule. Mirroir de `RemoveImprovementUseCase`, en
 * plus simple : pas de notion `estDefaut` (aucun avantage n'est intégré au profil de
 * base d'un véhicule), donc pas de distinction Forbidden/BadRequest.
 */
export class RemoveAdvantageUseCase {
  constructor(private readonly teamRepo: ITeamRepository) {}

  @LogUseCase()
  async execute(cmd: RemoveAdvantageCommand): Promise<Vehicle> {
    const team = await this.teamRepo.findByVehicleId(cmd.vehicleId, cmd.userId);
    const vehicle = team.findVehicle(cmd.vehicleId);

    const advantage = vehicle.advantages.find((a) => a.id === cmd.advantageId);
    if (!advantage) {
      throw new BadRequestException(
        `Avantage #${cmd.advantageId} introuvable sur le véhicule #${cmd.vehicleId}`,
      );
    }

    try {
      team.removeAdvantageFromVehicle(cmd.vehicleId, cmd.advantageId);
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    const saved = await this.teamRepo.save(team);
    return saved.findVehicle(cmd.vehicleId);
  }
}
