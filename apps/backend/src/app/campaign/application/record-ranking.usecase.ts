import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { DomainException } from '../../shared/domain/domain-exception';
import { RankingAssignedEvent } from '../domain/events/ranking-assigned.event';
import type { Campaign } from '../domain/campaign';
import type { CampaignParticipant } from '../domain/campaign-participant';

export interface RecordRankingCommand {
  campaignId: number;
  gameId: number;
  participantId: number;
  userId: number;    // connecté — vérifié contre la liste des organisateurs
  rank: number;
  championshipPoints: number;
}

/**
 * B1-B2 — Enregistre le classement d'un participant après une partie.
 *
 * Les PC sont figés au moment de l'appel (D-S8) — un changement de barème futur
 * n'affectera pas les résultats déjà enregistrés.
 */
export class RecordRankingUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
  ) {}

  async execute(cmd: RecordRankingCommand): Promise<void> {
    const campaign = await this.replayService.loadAndReplay(cmd.campaignId);
    assertOrganizer(campaign, cmd.userId);

    if (cmd.rank < 1) throw new BadRequestException('Le rang doit être >= 1.');
    if (cmd.championshipPoints < 0) throw new BadRequestException('Les PC ne peuvent pas être négatifs.');

    const event = new RankingAssignedEvent(0, cmd.gameId, cmd.participantId, 0, cmd.rank, cmd.championshipPoints);
    try {
      campaign.applyNewEvent(cmd.gameId, event);
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    await this.campaignRepo.appendEvents(cmd.gameId, [event]);
  }
}

// ── Helpers partagés ────────────────────────────────────────────────────────────
// Exportés pour réutilisation dans les autres use cases de ce module.

export function assertOrganizer(campaign: Campaign, userId: number): CampaignParticipant {
  const p = campaign.participants.find((x) => x.userId === userId && x.isOrganizer);
  if (!p) throw new NotFoundException('Saison introuvable ou accès non autorisé.');
  return p;
}

export function assertParticipant(campaign: Campaign, userId: number): CampaignParticipant {
  const p = campaign.participants.find((x) => x.userId === userId);
  if (!p) throw new NotFoundException('Saison introuvable ou accès non autorisé.');
  return p;
}
