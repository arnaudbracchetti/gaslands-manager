import { BadRequestException } from '@nestjs/common';
import type { ITeamRepository } from '../domain/team.repository.interface';
import type { Vehicle } from '../domain/vehicle';
import { DomainException } from '../domain/team';
import { LogUseCase } from '../log-use-case.decorator';

export interface RemoveWeaponCommand {
  weaponId: number;
  userId: number;
}

/**
 * Retire une arme d'un véhicule. Charge le Team via weaponId (findByWeaponId).
 * Retourne le véhicule mis à jour (le frontend l'utilise pour rafraîchir sans
 * relire toute l'équipe — cf. EquipmentDataSource, F4).
 */
export class RemoveWeaponUseCase {
  constructor(private readonly teamRepo: ITeamRepository) {}

  @LogUseCase()
  async execute(cmd: RemoveWeaponCommand): Promise<Vehicle> {
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

    const saved = await this.teamRepo.save(team);
    return saved.findVehicle(vehicle.id);
  }
}
