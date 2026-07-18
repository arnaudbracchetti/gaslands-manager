import { BadRequestException } from '@nestjs/common';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { DomainException } from '../../shared/domain/domain-exception';
import { assertParticipant } from './authorization.helpers';

export interface RenameCampaignVehicleCommand {
  campaignId: number;
  userId: number;
  vehicleId: number;
  nom: string;
}

/**
 * Renomme un véhicule en Atelier (participant sur SA PROPRE équipe, comme
 * `ChangeEquipmentUseCase` — pas `assertOrganizer`). Fonctionne identiquement pour
 * un véhicule pré-existant ou transient de la session en cours (D-S11) : aucun
 * branchement sur le signe de `vehicleId`, cf. Game.renameVehicle.
 */
export class RenameCampaignVehicleUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
  ) {}

  async execute(cmd: RenameCampaignVehicleCommand): Promise<void> {
    const campaign = await this.replayService.loadAndReplay(cmd.campaignId);
    const me = assertParticipant(campaign, cmd.userId);

    try {
      const game = campaign.findAtelierGame();
      const events = game.renameVehicle(me, cmd.vehicleId, cmd.nom);
      await this.campaignRepo.appendEvents(game.id, events);
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }
  }
}
