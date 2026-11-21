import { BadRequestException, ConflictException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DomainException } from '../../shared/domain/domain-exception';
import { HouseRules } from '../domain/house-rules/house-rules';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import type { ITeamRepository } from '../../team/domain/team.repository.interface';
import { HouseRuleCatalogService } from '../house-rule-catalog.service';

export interface CreateCampaignCommand {
  userId: number;
  name: string;
  teamId?: number | null;
  budget?: number;
  houseRules?: string[];
}

const DEFAULT_BUDGET = 50;

/**
 * Crée une campagne et inscrit son créateur comme organisateur VALIDATED.
 *
 * Cas particulier : aucun agrégat n'existe encore — on délègue directement à
 * `repo.createCampaign`. Les vérifications à données externes (appartenance de
 * l'équipe, unicité d'engagement, budget, règles maison) sont faites ici, avant
 * la persistance.
 */
export class CreateCampaignUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly teamRepo: ITeamRepository,
    private readonly houseRuleCatalog: HouseRuleCatalogService,
  ) {}

  async execute(cmd: CreateCampaignCommand): Promise<number> {
    const teamId = cmd.teamId ?? null;
    const budget = cmd.budget ?? DEFAULT_BUDGET;

    let houseRules: HouseRules;
    try {
      houseRules = HouseRules.fromUserInput(cmd.houseRules ?? [], this.houseRuleCatalog.validKeys());
    } catch (e: unknown) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

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
    return this.campaignRepo.createCampaign(cmd.name, inviteCode, cmd.userId, teamId, budget, houseRules.toArray());
  }
}
