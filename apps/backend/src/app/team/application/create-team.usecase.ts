import type { ITeamRepository, TeamSummaryDto } from '../domain/team.repository.interface';
import { Team } from '../domain/team';
import { LogUseCase } from '../log-use-case.decorator';

export interface CreateTeamCommand {
  userId: number;
  name: string;
  sponsor?: string;
  cans?: number;
  description?: string | null;
}

/**
 * Crée une nouvelle équipe pour l'utilisateur connecté.
 * Le sponsor, les jerricans et la description ont des valeurs par défaut.
 */
export class CreateTeamUseCase {
  constructor(private readonly teamRepo: ITeamRepository) {}

  @LogUseCase()
  async execute(cmd: CreateTeamCommand): Promise<TeamSummaryDto> {
    const team = new Team(
      0,
      cmd.userId,
      cmd.name,
      cmd.sponsor ?? 'Rutherford',
      cmd.cans ?? 50,
      cmd.description ?? null,
      [],
    );
    const saved = await this.teamRepo.save(team);
    return this.teamRepo.findSummaryById(saved.id);
  }
}
