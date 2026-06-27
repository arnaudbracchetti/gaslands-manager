import { BadRequestException } from '@nestjs/common';
import type { ITeamRepository } from '../domain/team.repository.interface';
import type { Team } from '../domain/team';
import { DomainException } from '../domain/team';
import { LogUseCase } from '../log-use-case.decorator';

export interface UnassignWeaponFromTourelleCommand {
  vehicleId: number;
  improvementId: number;
  userId: number;
}

/** Désassigne l'arme d'une Tourelle (retour en état orphelin). */
export class UnassignWeaponFromTourelleUseCase {
  constructor(private readonly teamRepo: ITeamRepository) {}

  @LogUseCase()
  async execute(cmd: UnassignWeaponFromTourelleCommand): Promise<Team> {
    const team = await this.teamRepo.findByVehicleId(cmd.vehicleId, cmd.userId);

    try {
      team.unassignWeaponFromTourelle(cmd.vehicleId, cmd.improvementId);
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    return this.teamRepo.save(team);
  }
}
