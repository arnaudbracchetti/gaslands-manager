import { BadRequestException } from '@nestjs/common';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { CampaignState } from '../campaign.enums';
import { assertOrganizer } from './record-ranking.usecase';

export interface ChangeStateCommand {
  campaignId: number;
  userId: number;
  state: CampaignState;
}

/**
 * Change l'état d'une campagne (transitions bidirectionnelles — décision de design).
 * En passant à TERMINEE, l'agrégat clôt les ateliers OUVERT restants.
 */
export class ChangeStateUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
  ) {}

  async execute(cmd: ChangeStateCommand): Promise<void> {
    const campaign = await this.replayService.load(cmd.campaignId);
    assertOrganizer(campaign, cmd.userId);

    try {
      campaign.changeState(cmd.state);
    } catch (e: unknown) {
      throw new BadRequestException((e as Error).message);
    }

    await this.campaignRepo.saveStructural(campaign);
  }
}
