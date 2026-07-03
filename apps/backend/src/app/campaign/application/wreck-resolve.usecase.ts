import { BadRequestException } from '@nestjs/common';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { DomainException } from '../../shared/domain/domain-exception';
import { WreckResolverService } from '../infrastructure/wreck-resolver.service';
import { WreckResolvedEvent } from '../domain/events/wreck-resolved.event';
import { VehicleLostEvent } from '../domain/events/vehicle-lost.event';
import { WeaponLostEvent } from '../domain/events/weapon-lost.event';
import { WreckResult } from '../domain/enums/wreck-result.enum';
import type { GameEvent } from '../domain/events/game-event';
import type { CampaignParticipant } from '../domain/campaign-participant';
import type { WreckOutcome } from '../domain/wreck/wreck-outcome';
import { assertOrganizer } from './record-ranking.usecase';

export interface WreckResolveCommand {
  campaignId: number;
  gameId: number;
  participantId: number;
  userId: number;
  vehicleId: number;
  /** Requis si le joueur anticipe un résultat ARME_PERDUE, null sinon. */
  weaponIdChoice?: number | null;
}

export interface WreckResolveResult {
  outcome: WreckOutcome;
}

/**
 * E1-E3 — Résout la Table des Épaves via le D6 serveur (D-S9).
 *
 * Produit :
 * - Toujours : `WreckResolvedEvent` (snapshot D6 + résultat)
 * - Si EPAVE   : `VehicleLostEvent`
 * - Si ARME_PERDUE + weaponIdChoice renseigné : `WeaponLostEvent`
 *
 * Les Chocs sont gagnés via `WreckResolvedEvent.execute` (appel à `vehicle.addChocs`).
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

    const participant = campaign.participants.find(p => p.id === cmd.participantId) as CampaignParticipant | undefined;
    if (!participant) throw new Error(`Participant ${cmd.participantId} introuvable.`);

    try {
      const vehicle = participant.team.findVehicle(cmd.vehicleId);
      const outcome = this.wreckResolver.resolve(vehicle, cmd.weaponIdChoice ?? null);

      const events: GameEvent[] = [];

      const wreckEvent = new WreckResolvedEvent(
        0, cmd.gameId, cmd.participantId, 0,
        outcome.vehicleId, outcome.diceRoll, outcome.chocsBefore,
        outcome.wreckResult, outcome.chocsGained, outcome.weaponLostId,
      );
      campaign.applyNewEvent(cmd.gameId, wreckEvent);
      events.push(wreckEvent);

      if (outcome.wreckResult === WreckResult.EPAVE) {
        const vehicleLostEvent = new VehicleLostEvent(0, cmd.gameId, cmd.participantId, 0, cmd.vehicleId);
        campaign.applyNewEvent(cmd.gameId, vehicleLostEvent);
        events.push(vehicleLostEvent);
      }

      if (outcome.wreckResult === WreckResult.ARME_PERDUE && outcome.weaponLostId !== null) {
        const weaponLostEvent = new WeaponLostEvent(0, cmd.gameId, cmd.participantId, 0, outcome.weaponLostId);
        campaign.applyNewEvent(cmd.gameId, weaponLostEvent);
        events.push(weaponLostEvent);
      }

      await this.campaignRepo.appendEvents(cmd.gameId, events);
      return { outcome };
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }
  }
}
