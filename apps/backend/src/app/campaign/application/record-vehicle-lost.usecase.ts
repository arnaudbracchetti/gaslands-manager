import { BadRequestException } from '@nestjs/common';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { DomainException } from '../../shared/domain/domain-exception';
import { assertOrganizer } from './authorization.helpers';

export interface RecordVehicleLostCommand {
  campaignId: number;
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
    const campaign = await this.replayService.loadAndReplay(cmd.campaignId);
    assertOrganizer(campaign, cmd.userId);
    const game = campaign.findGame(cmd.gameId);

    try {
      const events = game.recordVehicleLost(cmd.participantId, cmd.vehicleId, cmd.weaponIds);
      await this.campaignRepo.appendEvents(cmd.gameId, events);
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }
  }
}
