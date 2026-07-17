import { BadRequestException } from '@nestjs/common';
import { DomainException } from '../../shared/domain/domain-exception';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import type { GameEvent } from '../domain/events/game-event';
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

export interface JerricanGainCommandItem {
  participantId: number;
  amount: number;
}

export interface EscarmoucheDestroyedVehicleCommandItem {
  destroyerId: number;
  vehicleId: number;
}

export interface RecordResultCommand {
  campaignId: number;
  gameId: number;
  userId: number;
  /** Classement + exploits — Événement Télévisé uniquement (`Game.recordResult` refuse sinon). */
  results?: RecordResultCommandItem[];
  /** Butin manuel de jerricans (scénario `gain_jerricans`) — Escarmouche uniquement. */
  jerricanGains?: JerricanGainCommandItem[];
  /** Véhicules ennemis détruits hors classement, trace journal à 0 PC — Escarmouche uniquement. */
  destroyedVehicles?: EscarmoucheDestroyedVehicleCommandItem[];
}

/**
 * Enregistre le résultat d'une partie (organisateur, partie PLANIFIE).
 *
 * Convergence event-sourcing, branchée par type de partie :
 * - Événement Télévisé (`results`) : `Game.recordResult` crée un `RankingAssignedEvent`
 *   par participant (PC calculés selon le barème), plus les événements d'exploits/
 *   résistance. Rejeté (`DomainException`) si la partie n'est pas un Événement Télévisé.
 * - Escarmouche (`jerricanGains`/`destroyedVehicles`) : pas de classement, pas de PC, pas
 *   de Points de Résistance — `Game.recordJerricanGains` crédite le butin manuel de
 *   scénario, `Game.recordDestroyedVehicleTraces` trace les destructions sans PC (0
 *   Points de Championnat). Le revenu de base D6 est tiré séparément, cf.
 *   `RollIncomeUseCase`.
 *
 * Ne fait PAS entrer la partie en atelier — elle reste PLANIFIE pour que la suite du
 * wizard de fin de partie (résolution des revenus/épaves) puisse encore y journaliser
 * des événements. L'entrée en atelier (PLANIFIE → ATELIER) est déclenchée séparément
 * par `EnterAtelierUseCase`, à la toute fin du wizard.
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

    const events: GameEvent[] = [];
    try {
      if (cmd.results) {
        events.push(...game.recordResult(
          cmd.results.map((r) => ({
            participantId: r.participantId,
            rank: r.rank,
            gatesCrossed: r.gatesCrossed,
            destroyedVehicles: r.destroyedVehicles,
          })),
          campaign.participants,
        ));
      }
      if (cmd.jerricanGains) {
        events.push(...game.recordJerricanGains(cmd.jerricanGains));
      }
      if (cmd.destroyedVehicles) {
        events.push(...game.recordDestroyedVehicleTraces(cmd.destroyedVehicles, campaign.participants));
      }
    } catch (e: unknown) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    if (events.length > 0) {
      await this.campaignRepo.appendEvents(cmd.gameId, events);
    }
  }
}
