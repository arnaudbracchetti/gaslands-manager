import { BadRequestException, ConflictException } from '@nestjs/common';
import { DomainException } from '../../shared/domain/domain-exception';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import type { ITeamRepository } from '../../team/domain/team.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';

export interface RequestJoinCommand {
  campaignId: number;
  userId: number;
  teamId?: number | null;
}

/**
 * Crée une demande d'inscription (participant PENDING) pour l'utilisateur connecté.
 *
 * L'utilisateur n'a pas besoin d'être déjà membre : la campagne est chargée par
 * son id (obtenu via le code d'invitation). L'agrégat vérifie l'état
 * EN_CONSTRUCTION et l'absence de demande existante ; ici on vérifie l'équipe.
 */
export class RequestJoinUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
    private readonly teamRepo: ITeamRepository,
  ) {}

  async execute(cmd: RequestJoinCommand): Promise<number> {
    if (cmd.teamId == null) {
      throw new BadRequestException('Une équipe est requise pour rejoindre la campagne.');
    }
    // Lève NotFoundException si l'équipe n'appartient pas à l'utilisateur.
    await this.teamRepo.findByIdForUser(cmd.teamId, cmd.userId);
    if (await this.campaignRepo.isTeamEngaged(cmd.teamId)) {
      throw new ConflictException('Cette équipe est déjà engagée dans une autre campagne.');
    }

    const campaign = await this.replayService.loadAndReplay(cmd.campaignId);

    let participantId: number;
    try {
      const participant = campaign.requestJoin(cmd.userId, cmd.teamId);
      await this.campaignRepo.saveStructural(campaign);
      participantId = participant.id;
    } catch (e: unknown) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }
    return participantId;
  }
}
