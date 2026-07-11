import { BadRequestException } from '@nestjs/common';
import type { ITeamRepository } from '../domain/team.repository.interface';
import { DomainException } from '../domain/team';
import { LogUseCase } from '../log-use-case.decorator';

export interface RemoveTeamCommand {
  teamId: number;
  userId: number;
}

/** Supprime une équipe et tout son contenu (cascade). */
export class RemoveTeamUseCase {
  constructor(private readonly teamRepo: ITeamRepository) {}

  @LogUseCase()
  async execute(cmd: RemoveTeamCommand): Promise<void> {
    const team = await this.teamRepo.findByIdForUser(cmd.teamId, cmd.userId);

    try {
      team.assertNotLocked();
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    await this.teamRepo.remove(cmd.teamId, cmd.userId);
  }
}
