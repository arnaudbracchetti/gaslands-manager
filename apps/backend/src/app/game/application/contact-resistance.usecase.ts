import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { ResistanceContactedEvent } from '../domain/events/resistance-contacted.event';
import type { SeasonParticipant } from '../domain/season-participant';
import { assertOrganizer } from './record-ranking.usecase';

export interface ContactResistanceCommand {
  seasonId: number;
  gameId: number;
  participantId: number;
  userId: number;
}

/**
 * F1 — Enregistre qu'un participant a contacté la Résistance (+3 PR secrets).
 *
 * Les Points de Résistance n'apparaissent jamais dans le classement public
 * (cf. Season.standings() qui les exclut délibérément — D-S4).
 */
export class ContactResistanceUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
  ) {}

  async execute(cmd: ContactResistanceCommand): Promise<void> {
    const season = await this.replayService.loadAndReplay(cmd.seasonId);
    assertOrganizer(season, cmd.userId);

    const event = new ResistanceContactedEvent(0, cmd.gameId, cmd.participantId, 0);
    const game = season.findGame(cmd.gameId);
    game.addEvent(event);
    event.execute([...season.participants] as SeasonParticipant[]);

    await this.campaignRepo.appendEvents(cmd.gameId, [event]);
  }
}
