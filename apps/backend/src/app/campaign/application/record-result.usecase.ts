import { BadRequestException } from '@nestjs/common';
import { DomainException } from '../../shared/domain/domain-exception';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { assertOrganizer } from './record-ranking.usecase';

export interface RecordResultCommand {
  campaignId: number;
  gameId: number;
  userId: number;
  results: { participantId: number; rank: number }[];
}

/**
 * Enregistre le résultat d'une partie (organisateur, partie PLANIFIE).
 *
 * Convergence event-sourcing : l'agrégat crée un `RankingAssignedEvent` par
 * participant (PC calculés selon le type de partie) puis finalise la partie
 * (PLANIFIE → JOUE) et ouvre un AtelierGame intercalé. On persiste les
 * événements (`appendEvents`) puis la transition structurelle (`saveCampaign`).
 */
export class RecordResultUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
  ) {}

  async execute(cmd: RecordResultCommand): Promise<void> {
    const campaign = await this.replayService.load(cmd.campaignId);
    assertOrganizer(campaign, cmd.userId);

    let outcome;
    try {
      outcome = campaign.recordResult(
        cmd.gameId,
        cmd.results.map((r) => ({ participantId: r.participantId, rank: r.rank })),
      );
    } catch (e: unknown) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    await this.campaignRepo.appendEvents(cmd.gameId, outcome.events);
    await this.campaignRepo.saveCampaign(campaign, outcome.newAtelier);
  }
}
