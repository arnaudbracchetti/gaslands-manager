import { BadRequestException } from '@nestjs/common';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { DomainException } from '../../shared/domain/domain-exception';
import { WreckResolverService } from '../infrastructure/wreck-resolver.service';
import { WreckResolvedEvent } from '../domain/events/wreck-resolved.event';
import { VehicleLostEvent } from '../domain/events/vehicle-lost.event';
import { WeaponLostEvent } from '../domain/events/weapon-lost.event';
import { ImprovementLostEvent } from '../domain/events/improvement-lost.event';
import { SequellaAddedEvent } from '../domain/events/sequella-added.event';
import { FavoriDuPublicBonusEvent } from '../domain/events/favori-du-public-bonus.event';
import { WreckResult } from '../domain/enums/wreck-result.enum';
import type { GameEvent } from '../domain/events/game-event';
import type { WreckOutcome } from '../domain/wreck/wreck-outcome';
import { assertOrganizer } from './record-ranking.usecase';

/** +5 PC — Table des Épaves, ligne 9 (Favori du public), effet différé confirmé ligne 10+. */
const FAVORI_DU_PUBLIC_BONUS_POINTS = 5;

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
 * jamais un choix de l'organisateur. Produit selon la ligne obtenue :
 * - Toujours : `WreckResolvedEvent` (snapshot D6 + résultat, applique les Chocs)
 * - `ARRACHEE` : `WeaponLostEvent` ou `ImprovementLostEvent` selon l'équipement tiré
 * - `SIEGE_IRRECUPERABLE` : `SequellaAddedEvent` (coût 0 — imposé par la table, pas un
 *   achat Atelier)
 * - `VEHICULE_DETRUIT` : `VehicleLostEvent`, puis `FavoriDuPublicBonusEvent` si
 *   `pendingFavoriDuPublic` est vrai
 */
export class WreckResolveUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
    private readonly wreckResolver: WreckResolverService,
  ) {}

  async execute(cmd: WreckResolveCommand): Promise<WreckResolveResult> {
    const campaign = await this.replayService.loadAndReplay(cmd.campaignId);
    assertOrganizer(campaign, cmd.userId);

    try {
      const participant = campaign.findParticipant(cmd.participantId);
      const vehicle = participant.team.findVehicle(cmd.vehicleId);
      const outcome = this.wreckResolver.resolve(vehicle);

      const events: GameEvent[] = [];

      const wreckEvent = new WreckResolvedEvent(
        0, cmd.gameId, cmd.participantId, 0,
        outcome.vehicleId, outcome.diceRoll, outcome.chocsBefore,
        outcome.wreckResult, outcome.chocsGained,
      );
      campaign.applyNewEvent(cmd.gameId, wreckEvent);
      events.push(wreckEvent);

      if (outcome.wreckResult === WreckResult.ARRACHEE && outcome.weaponLostId !== null) {
        const weaponLostEvent = new WeaponLostEvent(0, cmd.gameId, cmd.participantId, 0, outcome.weaponLostId);
        campaign.applyNewEvent(cmd.gameId, weaponLostEvent);
        events.push(weaponLostEvent);
      }

      if (outcome.wreckResult === WreckResult.ARRACHEE && outcome.improvementLostId !== null) {
        const improvementLostEvent = new ImprovementLostEvent(0, cmd.gameId, cmd.participantId, 0, outcome.improvementLostId);
        campaign.applyNewEvent(cmd.gameId, improvementLostEvent);
        events.push(improvementLostEvent);
      }

      if (outcome.wreckResult === WreckResult.SIEGE_IRRECUPERABLE) {
        const sequellaEvent = new SequellaAddedEvent(0, cmd.gameId, cmd.participantId, 0, cmd.vehicleId, 'siege_irrecuperable', 0);
        campaign.applyNewEvent(cmd.gameId, sequellaEvent);
        events.push(sequellaEvent);
      }

      if (outcome.wreckResult === WreckResult.VEHICULE_DETRUIT) {
        const vehicleLostEvent = new VehicleLostEvent(0, cmd.gameId, cmd.participantId, 0, cmd.vehicleId);
        campaign.applyNewEvent(cmd.gameId, vehicleLostEvent);
        events.push(vehicleLostEvent);

        if (cmd.pendingFavoriDuPublic) {
          const bonusEvent = new FavoriDuPublicBonusEvent(
            0, cmd.gameId, cmd.participantId, 0, cmd.vehicleId, FAVORI_DU_PUBLIC_BONUS_POINTS,
          );
          campaign.applyNewEvent(cmd.gameId, bonusEvent);
          events.push(bonusEvent);
        }
      }

      await this.campaignRepo.appendEvents(cmd.gameId, events);
      return { outcome, descriptions: events.map((e) => e.describe()) };
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }
  }
}
