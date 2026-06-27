import { BadRequestException } from '@nestjs/common';
import type { ITeamRepository } from '../domain/team.repository.interface';
import type { ICatalogRepository } from '../domain/catalog.repository.interface';
import type { Team } from '../domain/team';
import { DomainException } from '../domain/team';
import type { Orientation } from '../domain/team';
import type { ImprovementType } from '../domain/value-objects/improvement-type';
import { LogUseCase } from '../log-use-case.decorator';

export interface AddImprovementCommand {
  vehicleId: number;
  nomInterne: string;
  orientation?: Orientation | null;
  userId: number;
}

/**
 * Ajoute une amélioration à un véhicule.
 */
export class AddImprovementUseCase {
  constructor(
    private readonly teamRepo: ITeamRepository,
    private readonly catalogRepo: ICatalogRepository,
  ) {}

  @LogUseCase()
  async execute(cmd: AddImprovementCommand): Promise<Team> {
    const team = await this.teamRepo.findByVehicleId(cmd.vehicleId, cmd.userId);

    const improvementType = this.catalogRepo.getImprovementType(cmd.nomInterne);
    if (!improvementType) {
      throw new BadRequestException(`Amélioration inconnue du catalogue : "${cmd.nomInterne}"`);
    }

    const authorized = this.catalogRepo.getImprovementTypesForSponsor(team.sponsor);
    const isAuthorized = authorized.some((t: ImprovementType) => t.nomInterne === cmd.nomInterne);
    if (!isAuthorized) {
      throw new BadRequestException(
        `L'amélioration "${improvementType.nom}" n'est pas autorisée pour le sponsor "${team.sponsor}"`,
      );
    }

    try {
      team.addImprovementToVehicle(cmd.vehicleId, improvementType, cmd.orientation ?? null);
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    return this.teamRepo.save(team);
  }
}
