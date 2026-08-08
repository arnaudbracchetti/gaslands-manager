import { describe, it, expect, vi } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { RequestJoinUseCase } from './request-join.usecase';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import type { ITeamRepository } from '../../team/domain/team.repository.interface';
import type { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { Campaign } from '../domain/campaign';
import { CampaignState } from '../domain/enums/campaign.enums';
import { makeTeamWithVehicles, makeVehicleType } from '../domain/test-helpers';
import { Vehicle } from '../../team/domain/vehicle';

function makeFixture(campaignBudget: number, vehicleCount: number, isTeamEngaged = false) {
  const vehicle = new Vehicle(1, 3, makeVehicleType(), [], []);  // prix 12
  const team = makeTeamWithVehicles(3, Array(vehicleCount).fill(vehicle));

  const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_CONSTRUCTION, 'invite-code', [], [], campaignBudget);

  const teamRepo: ITeamRepository = {
    findByIdForUser: vi.fn().mockResolvedValue(team),
  } as unknown as ITeamRepository;

  const campaignRepo: ICampaignRepository = {
    isTeamEngaged: vi.fn().mockResolvedValue(isTeamEngaged),
    saveStructural: vi.fn().mockResolvedValue(undefined),
  } as unknown as ICampaignRepository;

  const replayService: CampaignReplayService = {
    loadAndReplay: vi.fn().mockResolvedValue(campaign),
  } as unknown as CampaignReplayService;

  const useCase = new RequestJoinUseCase(campaignRepo, replayService, teamRepo);
  return { useCase, campaignRepo, teamRepo };
}

describe('RequestJoinUseCase', () => {
  it('crée la demande PENDING quand l\'équipe tient dans le budget de la campagne', async () => {
    const { useCase, campaignRepo } = makeFixture(50, 1);  // coût 12 ≤ 50

    await useCase.execute({ campaignId: 1, userId: 7, teamId: 3 });

    expect(campaignRepo.saveStructural).toHaveBeenCalled();
  });

  it('refuse une équipe dont le coût dépasse le budget de la campagne', async () => {
    const { useCase } = makeFixture(20, 5);  // coût 60 > 20

    await expect(useCase.execute({ campaignId: 1, userId: 7, teamId: 3 })).rejects.toThrow(BadRequestException);
  });

  it('refuse une équipe déjà engagée dans une autre campagne', async () => {
    const { useCase } = makeFixture(50, 1, true);

    await expect(useCase.execute({ campaignId: 1, userId: 7, teamId: 3 })).rejects.toThrow(ConflictException);
  });

  it('refuse sans teamId', async () => {
    const { useCase } = makeFixture(50, 1);

    await expect(useCase.execute({ campaignId: 1, userId: 7 })).rejects.toThrow(BadRequestException);
  });
});
