import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { RankingAssignedEvent } from '../domain/events/ranking-assigned.event';
import type { Season } from '../domain/season';
import type { SeasonParticipant } from '../domain/season-participant';

export interface RecordRankingCommand {
  seasonId: number;
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
    const season = await this.replayService.loadAndReplay(cmd.seasonId);
    assertOrganizer(season, cmd.userId);

    if (cmd.rank < 1) throw new BadRequestException('Le rang doit être >= 1.');
    if (cmd.championshipPoints < 0) throw new BadRequestException('Les PC ne peuvent pas être négatifs.');

    const event = new RankingAssignedEvent(0, cmd.gameId, cmd.participantId, 0, cmd.rank, cmd.championshipPoints);
    const game = season.findGame(cmd.gameId);
    game.addEvent(event);                                // valide canAccept
    event.execute([...season.participants] as SeasonParticipant[]);

    await this.campaignRepo.appendEvents(cmd.gameId, [event]);
  }
}

// ── Helpers partagés ────────────────────────────────────────────────────────────
// Exportés pour réutilisation dans les autres use cases de ce module.

export function assertOrganizer(season: Season, userId: number): SeasonParticipant {
  const p = season.participants.find((x) => x.userId === userId && x.isOrganizer);
  if (!p) throw new NotFoundException('Saison introuvable ou accès non autorisé.');
  return p;
}

export function assertParticipant(season: Season, userId: number): SeasonParticipant {
  const p = season.participants.find((x) => x.userId === userId);
  if (!p) throw new NotFoundException('Saison introuvable ou accès non autorisé.');
  return p;
}
