import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { VehicleLostEvent } from '../domain/events/vehicle-lost.event';
import { WeaponLostEvent } from '../domain/events/weapon-lost.event';
import type { GameEvent } from '../domain/events/game-event';
import type { SeasonParticipant } from '../domain/season-participant';
import { assertOrganizer } from './record-ranking.usecase';

export interface RecordVehicleLostCommand {
  seasonId: number;
  gameId: number;
  participantId: number;
  userId: number;
  vehicleId: number;
  /** Armes à marquer comme perdues en même temps — optionnel. */
  weaponIds?: number[];
}

/**
 * Enregistre la perte d'un véhicule (et optionnellement de ses armes) pendant
 * une partie. La résolution complète de la Table des Épaves (D6 serveur) est
 * distincte et sera traitée par WreckResolveUseCase (Partie 5).
 */
export class RecordVehicleLostUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
  ) {}

  async execute(cmd: RecordVehicleLostCommand): Promise<void> {
    const season = await this.replayService.loadAndReplay(cmd.seasonId);
    assertOrganizer(season, cmd.userId);

    const participants = [...season.participants] as SeasonParticipant[];
    const game = season.findGame(cmd.gameId);

    const events: GameEvent[] = [];

    const vehicleEvent = new VehicleLostEvent(0, cmd.gameId, cmd.participantId, 0, cmd.vehicleId);
    game.addEvent(vehicleEvent);
    vehicleEvent.execute(participants);
    events.push(vehicleEvent);

    for (const weaponId of cmd.weaponIds ?? []) {
      const weaponEvent = new WeaponLostEvent(0, cmd.gameId, cmd.participantId, 0, weaponId);
      game.addEvent(weaponEvent);
      weaponEvent.execute(participants);
      events.push(weaponEvent);
    }

    await this.campaignRepo.appendEvents(cmd.gameId, events);
  }
}
