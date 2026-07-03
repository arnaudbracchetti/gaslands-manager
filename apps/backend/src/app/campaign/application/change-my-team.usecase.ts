import { BadRequestException, ConflictException } from '@nestjs/common';
import { DomainException } from '../../shared/domain/domain-exception';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import type { ITeamRepository } from '../../team/domain/team.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';

export interface ChangeMyTeamCommand {
  campaignId: number;
  userId: number;
  teamId: number | null;
}

/**
 * Change l'équipe engagée par l'utilisateur connecté — campagne EN_CONSTRUCTION.
 * Le désengagement (teamId null) est réservé à l'organisateur (règle portée par
 * l'agrégat). L'appartenance et l'unicité d'engagement sont vérifiées ici.
 */
export class ChangeMyTeamUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
    private readonly teamRepo: ITeamRepository,
  ) {}

  async execute(cmd: ChangeMyTeamCommand): Promise<number> {
    if (cmd.teamId !== null) {
      // Lève NotFoundException si l'équipe n'appartient pas à l'utilisateur.
      await this.teamRepo.findByIdForUser(cmd.teamId, cmd.userId);
      if (await this.campaignRepo.isTeamEngaged(cmd.teamId, cmd.campaignId)) {
        throw new ConflictException('Cette équipe est déjà engagée dans une autre campagne.');
      }
    }

    const campaign = await this.replayService.load(cmd.campaignId);

    let participantId: number;
    try {
      const participant = campaign.changeParticipantTeam(cmd.userId, cmd.teamId);
      participantId = participant.id;
    } catch (e: unknown) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    await this.campaignRepo.saveStructural(campaign);
    return participantId;
  }
}
