import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import type { StandingsEntry } from '../domain/season';
import { assertParticipant } from './record-ranking.usecase';

export interface GetStandingsCommand {
  seasonId: number;
  userId: number;
}

/**
 * C1 — Retourne le classement de la saison après replay complet.
 *
 * Accessible à tout participant VALIDATED (organisateur ou non).
 * `resistancePoints` est délibérément exclu de la réponse (D-S4).
 */
export class GetStandingsUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
  ) {}

  async execute(cmd: GetStandingsCommand): Promise<StandingsEntry[]> {
    const season = await this.replayService.loadAndReplay(cmd.seasonId);
    assertParticipant(season, cmd.userId);
    return season.standings();
  }
}
