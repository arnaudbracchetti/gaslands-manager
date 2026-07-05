import { BadRequestException } from '@nestjs/common';
import { DomainException } from '../../shared/domain/domain-exception';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { assertOrganizer } from './record-ranking.usecase';

export interface EnterAtelierCommand {
  campaignId: number;
  gameId: number;
  userId: number;
}

export interface EnterAtelierResult {
  /** Id de la partie dont l'atelier a été auto-clôturé, s'il y en avait un ; sinon null. */
  autoClosedGameId: number | null;
}

/**
 * Fait entrer une partie en atelier (PLANIFIE → ATELIER, D-S7) : le résultat vient
 * d'être enregistré (wizard de fin de partie), la phase garage post-partie s'ouvre
 * sur cette même partie — plus de AtelierGame séparé.
 *
 * Séquence :
 * 1. `campaign.enterAtelier(gameId)` — transitions d'état en mémoire
 * 2. `campaignRepo.saveCampaign(campaign)` — persiste les changements de statut
 */
export class EnterAtelierUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
  ) {}

  async execute(cmd: EnterAtelierCommand): Promise<EnterAtelierResult> {
    const campaign = await this.replayService.load(cmd.campaignId);
    // Pas de replay complet — enterAtelier opère sur les statuts, pas sur l'état transient.
    assertOrganizer(campaign, cmd.userId);

    let result: { autoClosedGameId: number | null };
    try {
      result = campaign.enterAtelier(cmd.gameId);
    } catch (e: unknown) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    await this.campaignRepo.saveCampaign(campaign);

    return result;
  }
}
