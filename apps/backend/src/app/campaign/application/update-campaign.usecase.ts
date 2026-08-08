import { BadRequestException } from '@nestjs/common';
import { DomainException } from '../../shared/domain/domain-exception';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { assertOrganizer } from './authorization.helpers';

export interface UpdateCampaignCommand {
  campaignId: number;
  userId: number;
  name: string;
  budget: number;
}

/**
 * Modifie le nom et le budget d'une campagne (organisateur, EN_CONSTRUCTION
 * uniquement). Le budget est rejeté (DomainException → BadRequestException) s'il
 * rendrait une équipe déjà engagée illégale (cf. Campaign.changeBudget).
 */
export class UpdateCampaignUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
  ) {}

  async execute(cmd: UpdateCampaignCommand): Promise<void> {
    const campaign = await this.replayService.loadAndReplay(cmd.campaignId);
    assertOrganizer(campaign, cmd.userId);

    try {
      campaign.rename(cmd.name);
      campaign.changeBudget(cmd.budget);
    } catch (e: unknown) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    await this.campaignRepo.saveStructural(campaign);
  }
}
