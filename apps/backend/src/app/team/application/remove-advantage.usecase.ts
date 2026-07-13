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
 * Retire un avantage acquis d'un véhicule. Mirroir de `RemoveImprovementUseCase` :
 * toute règle de refus (avantage introuvable...) est portée par l'agrégat
 * (`Vehicle.removeAdvantage`), la `DomainException` est uniformément traduite en
 * `BadRequestException` - aucun contrôle métier dupliqué dans le use case.
 */
export class RemoveAdvantageUseCase {
  constructor(private readonly teamRepo: ITeamRepository) {}

  @LogUseCase()
  async execute(cmd: RemoveAdvantageCommand): Promise<Vehicle> {
    const team = await this.teamRepo.findByVehicleId(cmd.vehicleId, cmd.userId);

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
