import { BadRequestException } from '@nestjs/common';
import { DomainException } from '../../shared/domain/domain-exception';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { assertOrganizer } from './authorization.helpers';

export interface ResetResultCommand {
  campaignId: number;
  gameId: number;
  userId: number;
}

/**
 * Annule le wizard de fin de partie en cours de résolution (organisateur) : supprime
 * TOUS les événements déjà journalisés sur cette partie (classement, exploits, revenus,
 * tirages d'épaves) en une seule opération atomique, la ramenant à un PLANIFIE vierge.
 *
 * Cohérent avec la persistance différée du wizard (cf. spec/CAMPAIGN.md — le lot
 * pré-épaves n'est écrit qu'à l'entrée de la phase de résolution) : "Annuler" avant
 * "Terminer" doit pouvoir tout défaire, y compris les tirages déjà résolus. La garde
 * "PLANIFIE uniquement" vit sur l'agrégat (`Game.resultEventIdsForReset`), pas ici.
 */
export class ResetResultUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
  ) {}

  async execute(cmd: ResetResultCommand): Promise<void> {
    const campaign = await this.replayService.load(cmd.campaignId);
    assertOrganizer(campaign, cmd.userId);
    const game = campaign.findGame(cmd.gameId);

    let eventIds: number[];
    try {
      eventIds = game.resultEventIdsForReset();
    } catch (e: unknown) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    if (eventIds.length > 0) {
      await this.campaignRepo.deleteEvents(eventIds);
    }
  }
}
