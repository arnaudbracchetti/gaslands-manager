import { BadRequestException } from '@nestjs/common';
import { DomainException } from '../../shared/domain/domain-exception';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { ScenarioCatalogService } from '../scenario-catalog.service';
import { GameType } from '../game.enums';
import { assertOrganizer } from './authorization.helpers';

export interface AddGameCommand {
  campaignId: number;
  userId: number;
  scenarioId: string;
  type?: GameType;
}

/**
 * Ajoute une partie PLANIFIE au Programme (organisateur, campagne
 * EN_CONSTRUCTION/EN_COURS). L'ordre est auto-append (MAX+1) côté agrégat.
 */
export class AddGameUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
    private readonly scenarioCatalog: ScenarioCatalogService,
  ) {}

  async execute(cmd: AddGameCommand): Promise<number> {
    const scenario = this.scenarioCatalog.getByNomInterne(cmd.scenarioId);
    if (!scenario) {
      throw new BadRequestException(`Scénario "${cmd.scenarioId}" introuvable.`);
    }
    const type = cmd.type ?? scenario.type;

    const campaign = await this.replayService.load(cmd.campaignId);
    assertOrganizer(campaign, cmd.userId);

    let gameId: number;
    try {
      const game = campaign.addGame(cmd.scenarioId, type);
      await this.campaignRepo.saveStructural(campaign);
      gameId = game.id;
    } catch (e: unknown) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }
    return gameId;
  }
}
