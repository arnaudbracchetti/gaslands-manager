import { BadRequestException } from '@nestjs/common';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { ScenarioCatalogService } from '../scenario-catalog.service';
import { GameType } from '../game.enums';
import { assertOrganizer } from './record-ranking.usecase';

export interface UpdateGameCommand {
  campaignId: number;
  gameId: number;
  userId: number;
  scenarioId?: string;
  type?: GameType;
}

/**
 * Modifie une partie PLANIFIE (organisateur, campagne EN_CONSTRUCTION/EN_COURS).
 * Mise à jour partielle : les champs absents conservent leur valeur actuelle
 * (l'agrégat `updateGame` exige scénario + type, résolus ici depuis la partie).
 */
export class UpdateGameUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
    private readonly scenarioCatalog: ScenarioCatalogService,
  ) {}

  async execute(cmd: UpdateGameCommand): Promise<number> {
    if (cmd.scenarioId !== undefined && !this.scenarioCatalog.getByNomInterne(cmd.scenarioId)) {
      throw new BadRequestException(`Scénario "${cmd.scenarioId}" introuvable.`);
    }

    const campaign = await this.replayService.load(cmd.campaignId);
    assertOrganizer(campaign, cmd.userId);

    try {
      const game = campaign.findGame(cmd.gameId);
      // scenarioId n'existe que sur les sous-types joués (EvenementTele/Escarmouche).
      const currentScenarioId = (game as unknown as { scenarioId?: string | null }).scenarioId ?? '';
      const scenarioId = cmd.scenarioId ?? currentScenarioId;
      const type = cmd.type ?? (game.type as GameType);
      campaign.updateGame(cmd.gameId, scenarioId, type);
    } catch (e: unknown) {
      throw new BadRequestException((e as Error).message);
    }

    await this.campaignRepo.saveStructural(campaign);
    return cmd.gameId;
  }
}
