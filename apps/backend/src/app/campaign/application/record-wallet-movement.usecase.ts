import { BadRequestException } from '@nestjs/common';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { DomainException } from '../../shared/domain/domain-exception';
import { WalletMovementEvent } from '../domain/events/wallet-movement.event';
import { WalletReason } from '../domain/enums/wallet-reason.enum';
import type { CampaignParticipant } from '../domain/campaign-participant';
import { assertOrganizer } from './record-ranking.usecase';

export interface RecordWalletMovementCommand {
  campaignId: number;
  gameId: number;
  participantId: number;
  userId: number;
  /** Positif = gain, négatif = dépense. */
  amount: number;
  reason: WalletReason;
}

/**
 * B3 — Enregistre un mouvement de cagnotte (gain de récompense ou dépense d'atelier).
 */
export class RecordWalletMovementUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
  ) {}

  async execute(cmd: RecordWalletMovementCommand): Promise<void> {
    const campaign = await this.replayService.loadAndReplay(cmd.campaignId);
    assertOrganizer(campaign, cmd.userId);

    const event = new WalletMovementEvent(0, cmd.gameId, cmd.participantId, 0, cmd.amount, cmd.reason);
    try {
      const game = campaign.findGame(cmd.gameId);
      game.addEvent(event);
      event.execute([...campaign.participants] as CampaignParticipant[]);
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    await this.campaignRepo.appendEvents(cmd.gameId, [event]);
  }
}
