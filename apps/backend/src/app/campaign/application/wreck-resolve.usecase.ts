import { BadRequestException } from '@nestjs/common';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { DomainException } from '../../shared/domain/domain-exception';
import { WreckTable } from '../domain/wreck/wreck-table';
import { WreckResult } from '../domain/enums/wreck-result.enum';
import type { WreckOutcome } from '../domain/wreck/wreck-outcome';
import { assertOrganizer } from './authorization.helpers';

export interface WreckResolveCommand {
  campaignId: number;
  gameId: number;
  participantId: number;
  userId: number;
  vehicleId: number;
  /**
   * Attestation manuelle de l'organisateur : ce véhicule porte déjà un bonus "Favori du
   * public" en attente d'une partie précédente (l'app ne mémorise pas cet état elle-même,
   * cf. design du wizard de fin de partie). Ignoré si le résultat n'est pas
   * `VEHICULE_DETRUIT`.
   */
  pendingFavoriDuPublic?: boolean;
}

export interface WreckResolveResult {
  outcome: WreckOutcome;
  /** Une ligne de texte par événement créé (cf. `GameEvent.describe()`), dans l'ordre. */
  descriptions: string[];
}

/**
 * E1-E3 — Résout la Table des Épaves via le D6 serveur (D-S9).
 *
 * Toute perte d'équipement (arme ou amélioration) est un tirage aléatoire serveur —
 * jamais un choix de l'organisateur. L'interprétation du résultat (quels événements
 * produire selon la ligne obtenue) vit dans `Campaign.resolveWreck()` — ce use case
 * ne fait que tirer le résultat (infrastructure) et déléguer à l'agrégat. Le bonus
 * "Favori du public" est une règle indépendante du tirage (attestation manuelle de
 * l'organisateur), traitée séparément via `Campaign.creditFavoriDuPublicBonus()`.
 */
export class WreckResolveUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
    private readonly wreckTable: WreckTable,
  ) {}

  async execute(cmd: WreckResolveCommand): Promise<WreckResolveResult> {
    const campaign = await this.replayService.loadAndReplay(cmd.campaignId);
    assertOrganizer(campaign, cmd.userId);

    try {
      const { events, outcome } = campaign.resolveWreck(
        cmd.gameId, cmd.participantId, cmd.vehicleId, this.wreckTable,
      );

      const bonusEvent = campaign.creditFavoriDuPublicBonus(
        cmd.gameId, cmd.participantId, outcome.vehicleId,
        outcome.wreckResult === WreckResult.VEHICULE_DETRUIT && (cmd.pendingFavoriDuPublic ?? false),
      );
      if (bonusEvent) events.push(bonusEvent);

      await this.campaignRepo.appendEvents(cmd.gameId, events);
      return { outcome, descriptions: events.map((e) => e.describe()) };
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }
  }
}
