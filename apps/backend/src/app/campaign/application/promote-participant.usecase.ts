import { BadRequestException } from '@nestjs/common';
import { DomainException } from '../../shared/domain/domain-exception';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { assertOrganizer } from './record-ranking.usecase';

export interface PromoteParticipantCommand {
  campaignId: number;
  pid: number;
  userId: number;
}

/** Promeut un participant VALIDATED au rang de co-organisateur — organisateur uniquement. */
export class PromoteParticipantUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
  ) {}

  async execute(cmd: PromoteParticipantCommand): Promise<void> {
    const campaign = await this.replayService.load(cmd.campaignId);
    assertOrganizer(campaign, cmd.userId);

    try {
      campaign.promoteParticipant(cmd.pid);
    } catch (e: unknown) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    await this.campaignRepo.saveStructural(campaign);
  }
}
