import { BadRequestException } from '@nestjs/common';
import { DomainException } from '../../shared/domain/domain-exception';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import type { IRandomizer } from '../domain/randomizer.interface';
import { WalletMovementEvent } from '../domain/events/wallet-movement.event';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { assertOrganizer } from './authorization.helpers';

export interface RollIncomeCommand {
  campaignId: number;
  gameId: number;
  userId: number;
  participantId: number;
}

export interface RollIncomeResult {
  amount: number;
  /** Une ligne de texte par événement créé (cf. `GameEvent.describe()`). */
  descriptions: string[];
}

/**
 * Escarmouche uniquement — revenu de base : tire 1D6 côté serveur (`IRandomizer`, même
 * port hexagonal que la Table des Épaves) et le crédite en jerricans à un participant
 * présent. Appelé une fois par participant pendant la phase de résolution du wizard de
 * fin de partie — miroir de `WreckResolveUseCase`, appelé une fois par véhicule.
 *
 * L'interprétation ("revenu = 1D6") vit sur `Game.rollBaseIncome` (domaine) ; ce use
 * case ne fait que tirer le dé (infrastructure) et déléguer.
 */
export class RollIncomeUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
    private readonly randomizer: IRandomizer,
  ) {}

  async execute(cmd: RollIncomeCommand): Promise<RollIncomeResult> {
    const campaign = await this.replayService.load(cmd.campaignId);
    assertOrganizer(campaign, cmd.userId);
    const game = campaign.findGame(cmd.gameId);

    let events;
    try {
      events = game.rollBaseIncome(cmd.participantId, this.randomizer);
    } catch (e: unknown) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    await this.campaignRepo.appendEvents(cmd.gameId, events);
    const [incomeEvent] = events;
    if (!(incomeEvent instanceof WalletMovementEvent)) {
      throw new Error('Game.rollBaseIncome doit toujours produire un WalletMovementEvent.');
    }
    return { amount: incomeEvent.amount, descriptions: events.map((e) => e.describe(campaign.participants)) };
  }
}
