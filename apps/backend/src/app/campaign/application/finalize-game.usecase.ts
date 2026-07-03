import { BadRequestException } from '@nestjs/common';
import { DomainException } from '../../shared/domain/domain-exception';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import type { AtelierGame } from '../domain/games/atelier-game';
import { assertOrganizer } from './record-ranking.usecase';

export interface FinalizeGameCommand {
  campaignId: number;
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
 * 1. `campaign.finalizeGame(gameId)` — transitions d'état en mémoire
 * 2. `campaignRepo.saveCampaign(campaign, newAtelier)` — persiste les changements
 *    et assigne un vrai id au nouvel atelier
 */
export class FinalizeGameUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
  ) {}

  async execute(cmd: FinalizeGameCommand): Promise<FinalizeGameResult> {
    const campaign = await this.replayService.load(cmd.campaignId);
    // Pas de replay complet — finalizeGame opère sur les statuts, pas sur l'état transient.
    assertOrganizer(campaign, cmd.userId);

    let newAtelier: AtelierGame;
    try {
      newAtelier = campaign.finalizeGame(cmd.gameId);
    } catch (e: unknown) {
      // DomainException → 400
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    await this.campaignRepo.saveCampaign(campaign, newAtelier);

    return {
      newAtelierId: newAtelier.id,
      newAtelierOrder: newAtelier.order,
    };
  }
}
