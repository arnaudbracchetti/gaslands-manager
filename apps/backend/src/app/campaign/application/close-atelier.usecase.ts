import { BadRequestException } from '@nestjs/common';
import { DomainException } from '../../shared/domain/domain-exception';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { assertOrganizer } from './record-ranking.usecase';

export interface CloseAtelierCommand {
  campaignId: number;
  gameId: number;
  userId: number;
}

/**
 * Clôture manuelle de l'atelier d'une partie (ATELIER → JOUE), à l'initiative de
 * l'organisateur. Verrouille définitivement la phase garage post-partie associée
 * à cette partie précise (plus d'achat/revente/séquelle possible dessus).
 */
export class CloseAtelierUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
  ) {}

  async execute(cmd: CloseAtelierCommand): Promise<void> {
    const campaign = await this.replayService.load(cmd.campaignId);
    assertOrganizer(campaign, cmd.userId);

    try {
      campaign.closeAtelier(cmd.gameId);
    } catch (e: unknown) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    await this.campaignRepo.saveCampaign(campaign);
  }
}
