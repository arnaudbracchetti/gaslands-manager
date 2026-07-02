import { NotFoundException } from '@nestjs/common';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { assertParticipant } from './record-ranking.usecase';
import type { WorkshopStateDto, WorkshopVehicleDto } from '../dto/workshop-state.dto';

export interface GetWorkshopCommand {
  campaignId: number;
  userId: number;
}

/**
 * État campagne de l'équipe du participant connecté après replay complet.
 * Inclut les entités transientes (achats atelier) et les effets accumulés
 * (perte, chocs, séquelles). `resistancePoints` est exclu (D-S4).
 */
export class GetWorkshopUseCase {
  constructor(private readonly replayService: CampaignReplayService) {}

  async execute(cmd: GetWorkshopCommand): Promise<WorkshopStateDto> {
    const campaign = await this.replayService.loadAndReplay(cmd.campaignId);
    const me = assertParticipant(campaign, cmd.userId);
    if (!me.hasTeam) {
      throw new NotFoundException('Campagne introuvable ou accès non autorisé.');
    }

    const vehicles: WorkshopVehicleDto[] = me.team.vehicles.map((v) => ({
      id: v.id,
      nomInterne: v.type.nomInterne,
      price: v.type.price,
      isLost: v.isLost,
      chocs: v.chocs,
      sequellas: v.sequellas.map((s) => ({
        nomInterne: s.nomInterne,
        nom: s.nom,
        chocsCost: s.chocsCost,
      })),
      weapons: v.weapons.map((w) => ({
        id: w.id,
        nomInterne: w.type.nomInterne,
        orientation: w.orientation,
        price: w.type.price,
        isLost: w.isLost,
      })),
    }));

    return {
      participantId: me.id,
      wallet: me.wallet,
      championshipPoints: me.championshipPoints,
      vehicles,
    };
  }
}
