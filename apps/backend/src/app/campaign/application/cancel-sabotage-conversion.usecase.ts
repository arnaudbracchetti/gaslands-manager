import { BadRequestException } from '@nestjs/common';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { DomainException } from '../../shared/domain/domain-exception';
import { assertParticipant } from './authorization.helpers';

export interface CancelSabotageConversionCommand {
  campaignId: number;
  userId: number;
}

/**
 * Annule la dernière conversion de sabotage (règle maison R5) du participant, tant que
 * l'atelier est ouvert. Orchestration pure : `Game.cancelSabotageConversion` porte les
 * contrôles (statut, existence, cagnotte jamais négative) et désigne l'événement à
 * supprimer ; ce use case le supprime (même mécanique que l'annulation d'un achat).
 */
export class CancelSabotageConversionUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
  ) {}

  async execute(cmd: CancelSabotageConversionCommand): Promise<void> {
    const campaign = await this.replayService.loadAndReplay(cmd.campaignId);
    const me = assertParticipant(campaign, cmd.userId);

    try {
      const game = campaign.findAtelierGame();
      const eventIds = game.cancelSabotageConversion(me);
      await this.campaignRepo.deleteEvents(eventIds);
    } catch (e) {
      if (e instanceof DomainException)
        throw new BadRequestException(e.message);
      throw e;
    }
  }
}
