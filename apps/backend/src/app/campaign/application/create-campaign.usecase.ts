import { ConflictException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import type { ITeamRepository } from '../../team/domain/team.repository.interface';

export interface CreateCampaignCommand {
  userId: number;
  name: string;
  teamId?: number | null;
}

/**
 * Crée une campagne et inscrit son créateur comme organisateur VALIDATED.
 *
 * Cas particulier : aucun agrégat n'existe encore — on délègue directement à
 * `repo.createCampaign`. Les vérifications à données externes (appartenance de
 * l'équipe, unicité d'engagement) sont faites ici, avant la persistance.
 */
export class CreateCampaignUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly teamRepo: ITeamRepository,
  ) {}

  async execute(cmd: CreateCampaignCommand): Promise<number> {
    const teamId = cmd.teamId ?? null;
    if (teamId !== null) {
      // Lève NotFoundException si l'équipe n'appartient pas à l'utilisateur.
      await this.teamRepo.findByIdForUser(teamId, cmd.userId);
      if (await this.campaignRepo.isTeamEngaged(teamId)) {
        throw new ConflictException('Cette équipe est déjà engagée dans une autre campagne.');
      }
    }

    const inviteCode = randomBytes(6).toString('hex');
    return this.campaignRepo.createCampaign(cmd.name, inviteCode, cmd.userId, teamId);
  }
}
