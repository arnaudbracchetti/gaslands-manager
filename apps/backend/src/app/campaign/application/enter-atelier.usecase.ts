import { BadRequestException } from '@nestjs/common';
import { DomainException } from '../../shared/domain/domain-exception';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import type { GameEvent } from '../domain/events/game-event';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { assertOrganizer } from './authorization.helpers';

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
 * Deux concepts distincts, orchestrés ici (RM-4) :
 * 1. Distribution des Points de Résistance automatiques (US-F1) — `Game.distributeResistance()`,
 *    no-op hors Événement Télévisé. Appelée SANS argument : la Strategy (règle par
 *    défaut ou règle maison) n'est jamais choisie ici — `Game` la résout elle-même
 *    via le contexte que `Campaign` lui a attaché (cf. `GameRulesContext`,
 *    `HouseRuleStrategyFactory`, et skill `ddd`, theory/aggregate-design.md, « Qui
 *    sélectionne une Strategy ? »). Reste un concept séparé de la transition de
 *    statut ci-dessous : `Campaign.enterAtelier` n'y touche pas.
 * 2. Transition de statut (`Campaign.enterAtelier(gameId)`, inchangée).
 *
 * Les deux mutations en mémoire (§1 et §2) sont validées AVANT toute écriture — si
 * l'une lève une `DomainException`, rien n'est persisté. Une fois validées, le
 * journal de distribution est persisté (`appendEvents`) **avant** le statut
 * (`saveCampaign`) — jamais l'inverse : aucune transaction n'existe dans le projet,
 * et la garde d'idempotence de `distributeResistance` (§1) rattrape un rejeu après un
 * échec sur la seconde écriture (statut resté PLANIFIE, distribution déjà journalisée
 * ne serait pas recréée).
 */
export class EnterAtelierUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
  ) {}

  async execute(cmd: EnterAtelierCommand): Promise<EnterAtelierResult> {
    const campaign = await this.replayService.loadAndReplay(cmd.campaignId);
    assertOrganizer(campaign, cmd.userId);

    let result: { autoClosedGameId: number | null };
    let distributionEvents: GameEvent[];
    try {
      const game = campaign.findGame(cmd.gameId);
      distributionEvents = game.distributeResistance();
      result = campaign.enterAtelier(cmd.gameId);
    } catch (e: unknown) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    if (distributionEvents.length > 0) {
      await this.campaignRepo.appendEvents(cmd.gameId, distributionEvents);
    }
    await this.campaignRepo.saveCampaign(campaign);

    return result;
  }
}
