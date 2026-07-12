import { BadRequestException } from '@nestjs/common';
import type { ITeamRepository } from '../domain/team.repository.interface';
import type { ICatalogRepository } from '../domain/catalog.repository.interface';
import type { Team } from '../domain/team';
import { DomainException } from '../domain/team';
import type { AdvantageType } from '../domain/value-objects/advantage-type';
import { LogUseCase } from '../log-use-case.decorator';

export interface AddAdvantageCommand {
  vehicleId: number;
  nomInterne: string;
  userId: number;
}

/**
 * Ajoute un avantage à un véhicule. Mirroir d'`AddImprovementUseCase`, sans orientation.
 */
export class AddAdvantageUseCase {
  constructor(
    private readonly teamRepo: ITeamRepository,
    private readonly catalogRepo: ICatalogRepository,
  ) {}

  @LogUseCase()
  async execute(cmd: AddAdvantageCommand): Promise<Team> {
    const team = await this.teamRepo.findByVehicleId(cmd.vehicleId, cmd.userId);

    const advantageType = this.catalogRepo.getAdvantageType(cmd.nomInterne);
    if (!advantageType) {
      throw new BadRequestException(`Avantage inconnu du catalogue : "${cmd.nomInterne}"`);
    }

    const authorized = this.catalogRepo.getAdvantageTypesForSponsor(team.sponsor);
    const isAuthorized = authorized.some((t: AdvantageType) => t.nomInterne === cmd.nomInterne);
    if (!isAuthorized) {
      throw new BadRequestException(
        `L'avantage "${advantageType.nom}" n'est pas autorisé pour le sponsor "${team.sponsor}"`,
      );
    }

    try {
      team.addAdvantageToVehicle(cmd.vehicleId, advantageType);
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    return this.teamRepo.save(team);
  }
}
