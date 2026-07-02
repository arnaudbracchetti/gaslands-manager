import { BadRequestException } from '@nestjs/common';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { assertOrganizer } from './record-ranking.usecase';

export interface RemoveParticipantCommand {
  campaignId: number;
  pid: number;
  userId: number;
}

/**
 * Retire définitivement un participant — organisateur uniquement,
 * campagne EN_CONSTRUCTION. L'agrégat protège le dernier organisateur validé.
 */
export class RemoveParticipantUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
  ) {}

  async execute(cmd: RemoveParticipantCommand): Promise<void> {
    const campaign = await this.replayService.load(cmd.campaignId);
    assertOrganizer(campaign, cmd.userId);

    try {
      campaign.removeParticipant(cmd.pid);
    } catch (e: unknown) {
      throw new BadRequestException((e as Error).message);
    }

    await this.campaignRepo.saveStructural(campaign);
  }
}
