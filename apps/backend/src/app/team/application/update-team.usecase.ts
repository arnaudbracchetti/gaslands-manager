import { BadRequestException } from '@nestjs/common';
import type { ITeamRepository, TeamSummaryDto } from '../domain/team.repository.interface';
import { DomainException } from '../domain/team';
import { LogUseCase } from '../log-use-case.decorator';

export interface UpdateTeamCommand {
  teamId: number;
  userId: number;
  name?: string;
  sponsor?: string;
  cans?: number;
  description?: string | null;
}

/**
 * Met à jour une équipe existante.
 *
 * L'agrégat complet est chargé (avec ses véhicules) pour que team.update() puisse
 * enforcer le verrouillage du sponsor côté backend (Phase 5).
 */
export class UpdateTeamUseCase {
  constructor(private readonly teamRepo: ITeamRepository) {}

  @LogUseCase()
  async execute(cmd: UpdateTeamCommand): Promise<TeamSummaryDto> {
    const team = await this.teamRepo.findByIdForUser(cmd.teamId, cmd.userId);

    try {
      team.update({
        name: cmd.name,
        sponsor: cmd.sponsor,
        cans: cmd.cans,
        description: cmd.description,
      });
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    await this.teamRepo.save(team);
    return this.teamRepo.findSummaryById(cmd.teamId);
  }
}
