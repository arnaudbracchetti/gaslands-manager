import { BadRequestException } from '@nestjs/common';
import type { ITeamRepository } from '../domain/team.repository.interface';
import type { Team } from '../domain/team';
import { DomainException } from '../domain/team';
import { LogUseCase } from '../log-use-case.decorator';

export interface RemoveWeaponCommand {
  weaponId: number;
  userId: number;
}

/** Retire une arme d'un véhicule. Charge le Team via weaponId (findByWeaponId). */
export class RemoveWeaponUseCase {
  constructor(private readonly teamRepo: ITeamRepository) {}

  @LogUseCase()
  async execute(cmd: RemoveWeaponCommand): Promise<Team> {
    const team = await this.teamRepo.findByWeaponId(cmd.weaponId, cmd.userId);

    // Trouve le véhicule qui possède cette arme
    const vehicle = team.vehicles.find((v) =>
      v.weapons.some((w) => w.id === cmd.weaponId),
    );
    if (!vehicle) {
      throw new BadRequestException(`Arme #${cmd.weaponId} introuvable`);
    }

    try {
      team.removeWeaponFromVehicle(vehicle.id, cmd.weaponId);
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    return this.teamRepo.save(team);
  }
}
