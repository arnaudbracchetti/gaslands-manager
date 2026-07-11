import { BadRequestException } from '@nestjs/common';
import type { ITeamRepository } from '../domain/team.repository.interface';
import type { ICatalogRepository } from '../domain/catalog.repository.interface';
import type { Team } from '../domain/team';
import type { VehicleType } from '../domain/value-objects/vehicle-type';
import { Improvement } from '../domain/improvement';
import { Weapon } from '../domain/weapon';
import { LogUseCase } from '../log-use-case.decorator';

export interface AddVehicleCommand {
  teamId: number;
  nomInterne: string;
  userId: number;
}

/**
 * Ajoute un véhicule "nu" à une équipe, avec ses améliorations par défaut.
 *
 * 1. Charge l'agrégat Team complet (vérifie l'appartenance userId).
 * 2. Vérifie que nomInterne est connu du catalogue.
 * 3. Vérifie que ce véhicule est autorisé par le sponsor de l'équipe.
 * 4. Insère les améliorations par défaut (estDefaut: true).
 * 5. Persiste via ITeamRepository.save(team).
 */
export class AddVehicleUseCase {
  constructor(
    private readonly teamRepo: ITeamRepository,
    private readonly catalogRepo: ICatalogRepository,
  ) {}

  @LogUseCase()
  async execute(cmd: AddVehicleCommand): Promise<Team> {
    const team = await this.teamRepo.findByIdForUser(cmd.teamId, cmd.userId);

    const vehicleType = this.catalogRepo.getVehicleType(cmd.nomInterne);
    if (!vehicleType) {
      throw new BadRequestException(`Véhicule inconnu du catalogue : "${cmd.nomInterne}"`);
    }

    const authorizedTypes = this.catalogRepo.getVehicleTypesForSponsor(team.sponsor);
    const isAuthorized = authorizedTypes.some((t: VehicleType) => t.nomInterne === cmd.nomInterne);
    if (!isAuthorized) {
      throw new BadRequestException(
        `Le véhicule "${vehicleType.nom}" n'est pas autorisé pour le sponsor "${team.sponsor}"`,
      );
    }

    const defaultImprovements: Improvement[] = vehicleType.defaultImprovements
      .map((nomInterne: string) => {
        const impType = this.catalogRepo.getImprovementType(nomInterne);
        if (!impType) return null;
        return new Improvement(0, impType, null, true);
      })
      .filter((imp): imp is Improvement => imp !== null);

    const defaultWeapons: Weapon[] = [];
    if (vehicleType.defaultWeaponNomInterne) {
      const weaponType = this.catalogRepo.getWeaponType(vehicleType.defaultWeaponNomInterne);
      if (weaponType) {
        defaultWeapons.push(new Weapon(0, weaponType, 'tourelle', true));
      }
    }

    team.addVehicle(vehicleType, defaultImprovements, defaultWeapons);
    return this.teamRepo.save(team);
  }
}
