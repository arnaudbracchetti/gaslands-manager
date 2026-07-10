import { BadRequestException } from '@nestjs/common';
import { DomainException } from '../../shared/domain/domain-exception';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { assertOrganizer } from './authorization.helpers';

export interface RecordResultCommandItem {
  participantId: number;
  rank: number;
  /** Portes franchies (exploit, US-B2) — optionnel, 0/absent si aucune. */
  gatesCrossed?: number;
  /**
   * Véhicules ennemis détruits (exploit, US-B2) — optionnel. Seul `vehicleId` est
   * transmis : le poids (et donc les PC) est dérivé côté serveur depuis le véhicule
   * réel (`Campaign.findVehicleType`), jamais fourni par l'appelant.
   */
  destroyedVehicles?: { vehicleId: number }[];
}

export interface RecordResultCommand {
  campaignId: number;
  gameId: number;
  userId: number;
  results: RecordResultCommandItem[];
}

/**
 * Enregistre le résultat d'une partie (organisateur, partie PLANIFIE).
 *
 * Convergence event-sourcing : l'agrégat crée un `RankingAssignedEvent` par
 * participant (PC calculés selon le type de partie), plus les événements
 * d'exploits/résistance. Ne fait PAS entrer la partie en atelier — elle reste
 * PLANIFIE pour que la suite du wizard de fin de partie (résolution de la
 * Table des Épaves) puisse encore y journaliser des événements. L'entrée en
 * atelier (PLANIFIE → ATELIER) est déclenchée séparément par
 * `EnterAtelierUseCase`, à la toute fin du wizard.
 */
export class RecordResultUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
  ) {}

  async execute(cmd: RecordResultCommand): Promise<void> {
    const campaign = await this.replayService.load(cmd.campaignId);
    assertOrganizer(campaign, cmd.userId);
    const game = campaign.findGame(cmd.gameId);

    let events;
    try {
      events = game.recordResult(
        cmd.results.map((r) => ({
          participantId: r.participantId,
          rank: r.rank,
          gatesCrossed: r.gatesCrossed,
          destroyedVehicles: r.destroyedVehicles,
        })),
        campaign.participants,
      );
    } catch (e: unknown) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    await this.campaignRepo.appendEvents(cmd.gameId, events);
  }
}
