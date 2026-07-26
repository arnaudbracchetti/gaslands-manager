import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { assertOrganizer } from './authorization.helpers';

export interface DeleteCampaignCommand {
  campaignId: number;
  userId: number;
}

/**
 * Supprime définitivement une campagne (organisateur uniquement).
 * La suppression cascade sur les participants et les parties (FK onDelete CASCADE).
 */
export class DeleteCampaignUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
  ) {}

  async execute(cmd: DeleteCampaignCommand): Promise<void> {
    const campaign = await this.replayService.loadAndReplay(cmd.campaignId);
    assertOrganizer(campaign, cmd.userId);
    await this.campaignRepo.deleteCampaign(cmd.campaignId);
  }
}
