import { BadRequestException } from '@nestjs/common';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { DomainException } from '../../shared/domain/domain-exception';
import { assertOrganizer } from './authorization.helpers';

export interface ContactResistanceCommand {
  campaignId: number;
  gameId: number;
  participantId: number;
  userId: number;
}

/**
 * F1 — Enregistre qu'un participant a contacté la Résistance (+3 PR secrets).
 *
 * Les Points de Résistance n'apparaissent jamais dans le classement public
 * (cf. Campaign.standings() qui les exclut délibérément — D-S4).
 */
export class ContactResistanceUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
  ) {}

  async execute(cmd: ContactResistanceCommand): Promise<void> {
    const campaign = await this.replayService.loadAndReplay(cmd.campaignId);
    assertOrganizer(campaign, cmd.userId);
    const game = campaign.findGame(cmd.gameId);

    try {
      const events = game.contactResistance(cmd.participantId);
      await this.campaignRepo.appendEvents(cmd.gameId, events);
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }
  }
}
