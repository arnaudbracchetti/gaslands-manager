import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { WreckResolverService } from '../infrastructure/wreck-resolver.service';
import { WreckResolvedEvent } from '../domain/events/wreck-resolved.event';
import { VehicleLostEvent } from '../domain/events/vehicle-lost.event';
import { WeaponLostEvent } from '../domain/events/weapon-lost.event';
import { WreckResult } from '../domain/enums/wreck-result.enum';
import type { GameEvent } from '../domain/events/game-event';
import type { SeasonParticipant } from '../domain/season-participant';
import type { WreckOutcome } from '../domain/wreck/wreck-outcome';
import { assertOrganizer } from './record-ranking.usecase';

export interface WreckResolveCommand {
  seasonId: number;
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
    const season = await this.replayService.loadAndReplay(cmd.seasonId);
    assertOrganizer(season, cmd.userId);

    const participant = season.participants.find(p => p.id === cmd.participantId) as SeasonParticipant | undefined;
    if (!participant) throw new Error(`Participant ${cmd.participantId} introuvable.`);

    const vehicle = participant.team.findVehicle(cmd.vehicleId);
    const outcome = this.wreckResolver.resolve(vehicle, cmd.weaponIdChoice ?? null);

    const participants = [...season.participants] as SeasonParticipant[];
    const game = season.findGame(cmd.gameId);
    const events: GameEvent[] = [];

    const wreckEvent = new WreckResolvedEvent(
      0, cmd.gameId, cmd.participantId, 0,
      outcome.vehicleId, outcome.diceRoll, outcome.chocsBefore,
      outcome.wreckResult, outcome.chocsGained, outcome.weaponLostId,
    );
    game.addEvent(wreckEvent);
    wreckEvent.execute(participants);
    events.push(wreckEvent);

    if (outcome.wreckResult === WreckResult.EPAVE) {
      const vehicleLostEvent = new VehicleLostEvent(0, cmd.gameId, cmd.participantId, 0, cmd.vehicleId);
      game.addEvent(vehicleLostEvent);
      vehicleLostEvent.execute(participants);
      events.push(vehicleLostEvent);
    }

    if (outcome.wreckResult === WreckResult.ARME_PERDUE && outcome.weaponLostId !== null) {
      const weaponLostEvent = new WeaponLostEvent(0, cmd.gameId, cmd.participantId, 0, outcome.weaponLostId);
      game.addEvent(weaponLostEvent);
      weaponLostEvent.execute(participants);
      events.push(weaponLostEvent);
    }

    await this.campaignRepo.appendEvents(cmd.gameId, events);
    return { outcome };
  }
}
