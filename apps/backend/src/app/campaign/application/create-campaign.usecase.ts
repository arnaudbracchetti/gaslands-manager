import { BadRequestException, ConflictException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import type { ITeamRepository } from '../../team/domain/team.repository.interface';

export interface CreateCampaignCommand {
  userId: number;
  name: string;
  teamId?: number | null;
  budget?: number;
}

const DEFAULT_BUDGET = 50;

/**
 * Crée une campagne et inscrit son créateur comme organisateur VALIDATED.
 *
 * Cas particulier : aucun agrégat n'existe encore — on délègue directement à
 * `repo.createCampaign`. Les vérifications à données externes (appartenance de
 * l'équipe, unicité d'engagement, budget) sont faites ici, avant la persistance.
 */
export class CreateCampaignUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly teamRepo: ITeamRepository,
  ) {}

  async execute(cmd: CreateCampaignCommand): Promise<number> {
    const teamId = cmd.teamId ?? null;
    const budget = cmd.budget ?? DEFAULT_BUDGET;
    if (teamId !== null) {
      // Lève NotFoundException si l'équipe n'appartient pas à l'utilisateur.
      const team = await this.teamRepo.findByIdForUser(teamId, cmd.userId);
      if (await this.campaignRepo.isTeamEngaged(teamId)) {
        throw new ConflictException('Cette équipe est déjà engagée dans une autre campagne.');
      }
      // L'organisateur ne peut pas engager d'emblée une équipe qui dépasse le
      // budget qu'il vient lui-même de fixer.
      if (team.vehiclesCost > budget) {
        throw new BadRequestException(
          `L'équipe « ${team.name} » coûte ${team.vehiclesCost} jerricans, au-delà du budget choisi (${budget}).`,
        );
      }
    }

    const inviteCode = randomBytes(6).toString('hex');
    return this.campaignRepo.createCampaign(cmd.name, inviteCode, cmd.userId, teamId, budget);
  }
}
