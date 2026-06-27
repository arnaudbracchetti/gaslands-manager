import { BadRequestException } from '@nestjs/common';
import type { ITeamRepository } from '../domain/team.repository.interface';
import type { ICatalogRepository } from '../domain/catalog.repository.interface';
import type { Team } from '../domain/team';
import { DomainException } from '../domain/team';
import type { WeaponType } from '../domain/value-objects/weapon-type';
import { LogUseCase } from '../log-use-case.decorator';

export interface AssignWeaponToTourelleCommand {
  vehicleId: number;
  improvementId: number;
  weaponNomInterne: string;
  userId: number;
}

/**
 * Assigne une arme à une Tourelle orpheline.
 * La garde budget ×3 est portée par Vehicle.assignWeaponToTourelle (via team).
 */
export class AssignWeaponToTourelleUseCase {
  constructor(
    private readonly teamRepo: ITeamRepository,
    private readonly catalogRepo: ICatalogRepository,
  ) {}

  @LogUseCase()
  async execute(cmd: AssignWeaponToTourelleCommand): Promise<Team> {
    const team = await this.teamRepo.findByVehicleId(cmd.vehicleId, cmd.userId);

    const weaponType = this.catalogRepo.getWeaponType(cmd.weaponNomInterne);
    if (!weaponType) {
      throw new BadRequestException(`Arme inconnue du catalogue : "${cmd.weaponNomInterne}"`);
    }

    const authorizedWeapons = this.catalogRepo.getWeaponTypesForSponsor(team.sponsor);
    const isAuthorized = authorizedWeapons.some((w: WeaponType) => w.nomInterne === cmd.weaponNomInterne);
    if (!isAuthorized) {
      throw new BadRequestException(
        `L'arme "${weaponType.nom}" n'est pas autorisée pour le sponsor "${team.sponsor}"`,
      );
    }

    if (weaponType.isEquipage) {
      throw new BadRequestException(
        `Les armes d'équipage ont déjà un arc de tir 360° — la Tourelle ne s'applique pas`,
      );
    }

    try {
      team.assignWeaponToTourelle(cmd.vehicleId, cmd.improvementId, weaponType);
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    return this.teamRepo.save(team);
  }
}
