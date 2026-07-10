import { BadRequestException } from '@nestjs/common';
import { DomainException } from '../../shared/domain/domain-exception';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { CampaignState } from '../domain/enums/campaign.enums';
import { assertOrganizer } from './authorization.helpers';

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
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    await this.campaignRepo.saveStructural(campaign);
  }
}
