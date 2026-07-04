import { NotFoundException } from '@nestjs/common';
import { DomainException } from '../../shared/domain/domain-exception';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { assertOrganizer } from './record-ranking.usecase';
import { weightClassFromPoids } from '../domain/enums/weight-class.enum';
import type { ParticipantVehiclesDto } from '../dto/participant-vehicles-response.dto';

export interface GetParticipantVehiclesCommand {
  campaignId: number;
  gameId: number;
  userId: number;
  /** Ids des participants dont on veut le roster — typiquement les présents à la partie. */
  participantIds: number[];
}

/**
 * Véhicules courants (hors perdus) des participants indiqués — alimente le
 * picker "véhicules ennemis détruits" de la saisie d'exploits (US-B2).
 *
 * Réservé à l'organisateur. Scope volontairement restreint aux participants
 * transmis par l'appelant (pas l'ensemble de la campagne) : "hors perdus"
 * (`isLost`) n'est connu qu'après replay complet, d'où l'usage de
 * `loadAndReplay` comme pour `GetWorkshopUseCase`/`GetStandingsUseCase`.
 */
export class GetParticipantVehiclesUseCase {
  constructor(private readonly replayService: CampaignReplayService) {}

  async execute(cmd: GetParticipantVehiclesCommand): Promise<ParticipantVehiclesDto[]> {
    const campaign = await this.replayService.loadAndReplay(cmd.campaignId);
    assertOrganizer(campaign, cmd.userId);

    try {
      campaign.findGame(cmd.gameId);

      return cmd.participantIds.map((participantId) => {
        const participant = campaign.findParticipant(participantId);
        if (!participant.hasTeam) {
          return { participantId, vehicles: [] };
        }
        const vehicles = participant.team.vehicles
          .filter((v) => !v.isLost)
          .map((v) => ({
            vehicleId: v.id,
            nom: v.type.nom,
            weightClass: weightClassFromPoids(v.type.poids),
          }));
        return { participantId, vehicles };
      });
    } catch (e) {
      if (e instanceof DomainException) throw new NotFoundException(e.message);
      throw e;
    }
  }
}
