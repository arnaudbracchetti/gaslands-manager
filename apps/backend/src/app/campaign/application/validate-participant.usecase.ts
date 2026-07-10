import { BadRequestException } from '@nestjs/common';
import { DomainException } from '../../shared/domain/domain-exception';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { assertOrganizer } from './authorization.helpers';

export interface ValidateParticipantCommand {
  campaignId: number;
  pid: number;
  userId: number;
  accept: boolean;
}

/**
 * Valide (accept=true) ou refuse (accept=false) un participant — organisateur
 * uniquement. Couvre PENDING→VALIDATED/REJECTED, VALIDATED→REJECTED et
 * REJECTED→VALIDATED. L'agrégat protège le dernier organisateur validé.
 */
export class ValidateParticipantUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
  ) {}

  async execute(cmd: ValidateParticipantCommand): Promise<void> {
    const campaign = await this.replayService.load(cmd.campaignId);
    assertOrganizer(campaign, cmd.userId);

    try {
      campaign.validateParticipant(cmd.pid, cmd.accept);
    } catch (e: unknown) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    await this.campaignRepo.saveStructural(campaign);
  }
}
