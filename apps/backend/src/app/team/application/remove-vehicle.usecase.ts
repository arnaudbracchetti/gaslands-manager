import { BadRequestException } from '@nestjs/common';
import type { ITeamRepository } from '../domain/team.repository.interface';
import { DomainException } from '../domain/team';
import { LogUseCase } from '../log-use-case.decorator';

export interface RemoveVehicleCommand {
  vehicleId: number;
  userId: number;
}

/** Supprime un véhicule et tout son équipement (cascade). */
export class RemoveVehicleUseCase {
  constructor(private readonly teamRepo: ITeamRepository) {}

  @LogUseCase()
  async execute(cmd: RemoveVehicleCommand): Promise<void> {
    const team = await this.teamRepo.findByVehicleId(cmd.vehicleId, cmd.userId);

    try {
      team.removeVehicle(cmd.vehicleId);
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    await this.teamRepo.save(team);
  }
}
