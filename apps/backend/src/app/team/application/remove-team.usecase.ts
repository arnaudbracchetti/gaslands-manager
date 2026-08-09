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

    const orphaned = await this.teamRepo.findCampaignsOrphanedIfTeamRemoved(cmd.teamId);
    if (orphaned.length > 0) {
      const names = orphaned.map((c) => c.name).join(', ');
      throw new BadRequestException(
        `La suppression de cette équipe laisserait les campagnes suivantes sans organisateur : ${names}. ` +
          'Engagez une autre équipe ou promouvez un autre organisateur avant de supprimer celle-ci.',
      );
    }

    await this.teamRepo.remove(cmd.teamId, cmd.userId);
  }
}
