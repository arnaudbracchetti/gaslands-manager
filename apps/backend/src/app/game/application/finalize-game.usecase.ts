import { BadRequestException } from '@nestjs/common';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import type { AtelierGame } from '../domain/games/atelier-game';
import { assertOrganizer } from './record-ranking.usecase';

export interface FinalizeGameCommand {
  seasonId: number;
  gameId: number;
  userId: number;
}

export interface FinalizeGameResult {
  /** Id du nouvel AtelierGame créé (assigné par le repository après persistance). */
  newAtelierId: number;
  /** Ordre fractionnaire du nouvel atelier (ex. 1.5). */
  newAtelierOrder: number;
}

/**
 * Finalise une partie PLANIFIE → JOUE et intercale un AtelierGame OUVERT (D-S7).
 *
 * Séquence :
 * 1. `season.finalizeGame(gameId)` — transitions d'état en mémoire
 * 2. `campaignRepo.saveSeason(season, newAtelier)` — persiste les changements
 *    et assigne un vrai id au nouvel atelier
 */
export class FinalizeGameUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
  ) {}

  async execute(cmd: FinalizeGameCommand): Promise<FinalizeGameResult> {
    const season = await this.replayService.load(cmd.seasonId);
    // Pas de replay complet — finalizeGame opère sur les statuts, pas sur l'état transient.
    assertOrganizer(season, cmd.userId);

    let newAtelier: AtelierGame;
    try {
      newAtelier = season.finalizeGame(cmd.gameId);
    } catch (e: unknown) {
      // DomainException → 400
      throw new BadRequestException((e as Error).message);
    }

    await this.campaignRepo.saveSeason(season, newAtelier);

    return {
      newAtelierId: newAtelier.id,
      newAtelierOrder: newAtelier.order,
    };
  }
}
