import { BadRequestException } from '@nestjs/common';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { DomainException } from '../../shared/domain/domain-exception';
import { assertParticipant } from './authorization.helpers';

export interface ConvertSabotageCommand {
  campaignId: number;
  userId: number;
}

/**
 * Règle maison « conversion de sabotage » : le participant convertit 1 jeton de sabotage
 * en jerricans, sur SA PROPRE équipe (`assertParticipant`, comme `ChangeEquipmentUseCase`).
 *
 * Orchestration pure : ce use case ne choisit pas la Strategy et ne teste ni la règle
 * maison, ni le statut, ni le solde de jetons — tout vit dans `Game.convertSabotage`.
 */
export class ConvertSabotageUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
  ) {}

  async execute(cmd: ConvertSabotageCommand): Promise<void> {
    const campaign = await this.replayService.loadAndReplay(cmd.campaignId);
    const me = assertParticipant(campaign, cmd.userId);

    try {
      const game = campaign.findAtelierGame();
      const events = game.convertSabotage(me);
      await this.campaignRepo.appendEvents(game.id, events);
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }
  }
}
