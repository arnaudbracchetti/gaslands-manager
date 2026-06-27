import type { ITeamRepository } from '../domain/team.repository.interface';
import { LogUseCase } from '../log-use-case.decorator';

export interface RemoveTeamCommand {
  teamId: number;
  userId: number;
}

/** Supprime une équipe et tout son contenu (cascade). */
export class RemoveTeamUseCase {
  constructor(private readonly teamRepo: ITeamRepository) {}

  @LogUseCase()
  execute(cmd: RemoveTeamCommand): Promise<void> {
    return this.teamRepo.remove(cmd.teamId, cmd.userId);
  }
}
