import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { WalletMovementEvent } from '../domain/events/wallet-movement.event';
import { WalletReason } from '../domain/enums/wallet-reason.enum';
import type { SeasonParticipant } from '../domain/season-participant';
import { assertOrganizer } from './record-ranking.usecase';

export interface RecordWalletMovementCommand {
  seasonId: number;
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
    const season = await this.replayService.loadAndReplay(cmd.seasonId);
    assertOrganizer(season, cmd.userId);

    const event = new WalletMovementEvent(0, cmd.gameId, cmd.participantId, 0, cmd.amount, cmd.reason);
    const game = season.findGame(cmd.gameId);
    game.addEvent(event);
    event.execute([...season.participants] as SeasonParticipant[]);

    await this.campaignRepo.appendEvents(cmd.gameId, [event]);
  }
}
