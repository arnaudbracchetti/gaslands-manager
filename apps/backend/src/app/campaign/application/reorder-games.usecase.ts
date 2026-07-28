import { BadRequestException } from '@nestjs/common';
import { DomainException } from '../../shared/domain/domain-exception';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { assertOrganizer } from './authorization.helpers';

export interface ReorderGamesCommand {
  campaignId: number;
  userId: number;
  /** Ids des parties encore PLANIFIE, dans le nouvel ordre voulu. */
  gameIds: number[];
}

/**
 * Réordonne les parties encore PLANIFIE du Programme (US-A4 — organisateur,
 * campagne EN_CONSTRUCTION/EN_COURS). Cf. `Campaign.reorderGames` pour la règle
 * complète (les parties ATELIER/JOUE gardent leur position figée).
 */
export class ReorderGamesUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
  ) {}

  async execute(cmd: ReorderGamesCommand): Promise<void> {
    const campaign = await this.replayService.loadAndReplay(cmd.campaignId);
    assertOrganizer(campaign, cmd.userId);

    try {
      campaign.reorderGames(cmd.gameIds);
    } catch (e: unknown) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    await this.campaignRepo.saveStructural(campaign);
  }
}
