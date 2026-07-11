import { BadRequestException } from '@nestjs/common';
import type { ITeamRepository } from '../domain/team.repository.interface';
import type { ICatalogRepository } from '../domain/catalog.repository.interface';
import type { Team } from '../domain/team';
import { DomainException } from '../domain/team';
import type { WeaponOrientation } from '../domain/team';
import type { WeaponType } from '../domain/value-objects/weapon-type';
import { LogUseCase } from '../log-use-case.decorator';

export interface AddWeaponCommand {
  vehicleId: number;
  nomInterne: string;
  orientation?: WeaponOrientation | null;
  userId: number;
}

/**
 * Ajoute une arme à un véhicule.
 *
 * Charge l'agrégat Team (via vehicleId), valide l'autorisation sponsor,
 * délègue la mutation à team.addWeaponToVehicle() qui utilise team.remainingBudget.
 */
export class AddWeaponUseCase {
  constructor(
    private readonly teamRepo: ITeamRepository,
    private readonly catalogRepo: ICatalogRepository,
  ) {}

  @LogUseCase()
  async execute(cmd: AddWeaponCommand): Promise<Team> {
    const team = await this.teamRepo.findByVehicleId(cmd.vehicleId, cmd.userId);

    const weaponType = this.catalogRepo.getWeaponType(cmd.nomInterne);
    if (!weaponType) {
      throw new BadRequestException(`Arme inconnue du catalogue : "${cmd.nomInterne}"`);
    }

    const authorizedWeapons = this.catalogRepo.getWeaponTypesForSponsor(team.sponsor);
    const isAuthorized = authorizedWeapons.some((w: WeaponType) => w.nomInterne === cmd.nomInterne);
    if (!isAuthorized) {
      throw new BadRequestException(
        `L'arme "${weaponType.nom}" n'est pas autorisée pour le sponsor "${team.sponsor}"`,
      );
    }

    try {
      team.addWeaponToVehicle(cmd.vehicleId, weaponType, cmd.orientation ?? null);
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    return this.teamRepo.save(team);
  }
}
