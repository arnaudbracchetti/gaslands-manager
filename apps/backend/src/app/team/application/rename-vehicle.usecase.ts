import { BadRequestException } from '@nestjs/common';
import type { ITeamRepository } from '../domain/team.repository.interface';
import type { Team } from '../domain/team';
import { DomainException } from '../domain/team';
import { LogUseCase } from '../log-use-case.decorator';

export interface RenameVehicleCommand {
  vehicleId: number;
  nom: string;
  userId: number;
}

/** Renomme un véhicule (construction d'équipe — refusé si l'équipe est verrouillée). */
export class RenameVehicleUseCase {
  constructor(private readonly teamRepo: ITeamRepository) {}

  @LogUseCase()
  async execute(cmd: RenameVehicleCommand): Promise<Team> {
    const team = await this.teamRepo.findByVehicleId(cmd.vehicleId, cmd.userId);

    try {
      team.renameVehicle(cmd.vehicleId, cmd.nom);
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    return this.teamRepo.save(team);
  }
}
