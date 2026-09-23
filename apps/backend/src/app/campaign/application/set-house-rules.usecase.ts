import { BadRequestException } from '@nestjs/common';
import { DomainException } from '../../shared/domain/domain-exception';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { HouseRuleCatalogService } from '../house-rule-catalog.service';
import { assertOrganizer } from './authorization.helpers';

export interface SetHouseRulesCommand {
  campaignId: number;
  userId: number;
  houseRules: string[];
}

/**
 * Active/désactive l'ensemble des règles maison d'une campagne (organisateur).
 * Aucune contrainte d'état — route dédiée (PUT /api/campaigns/:id/house-rules)
 * précisément pour ne jamais être bloquée par les gardes EN_CONSTRUCTION de
 * rename()/changeBudget() (UpdateCampaignUseCase). Une clé absente du catalogue
 * est rejetée en HTTP 400 (Campaign.setHouseRules).
 */
export class SetHouseRulesUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
    private readonly houseRuleCatalog: HouseRuleCatalogService,
  ) {}

  async execute(cmd: SetHouseRulesCommand): Promise<void> {
    const campaign = await this.replayService.loadAndReplay(cmd.campaignId);
    assertOrganizer(campaign, cmd.userId);

    try {
      campaign.setHouseRules(cmd.houseRules, this.houseRuleCatalog.validKeys());
    } catch (e: unknown) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    await this.campaignRepo.saveStructural(campaign);
  }
}
