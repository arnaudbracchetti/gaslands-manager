import { BadRequestException } from '@nestjs/common';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { assertOrganizer } from './record-ranking.usecase';

export interface RemoveGameCommand {
  campaignId: number;
  gameId: number;
  userId: number;
}

/** Supprime une partie PLANIFIE (organisateur, campagne EN_CONSTRUCTION/EN_COURS). */
export class RemoveGameUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
  ) {}

  async execute(cmd: RemoveGameCommand): Promise<void> {
    const campaign = await this.replayService.load(cmd.campaignId);
    assertOrganizer(campaign, cmd.userId);

    try {
      campaign.removeGame(cmd.gameId);
    } catch (e: unknown) {
      throw new BadRequestException((e as Error).message);
    }

    await this.campaignRepo.saveStructural(campaign);
  }
}
