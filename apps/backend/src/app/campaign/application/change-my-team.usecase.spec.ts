import { describe, it, expect, vi } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { ChangeMyTeamUseCase } from './change-my-team.usecase';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import type { ITeamRepository } from '../../team/domain/team.repository.interface';
import type { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { Campaign } from '../domain/campaign';
import { CampaignParticipant } from '../domain/campaign-participant';
import { ParticipantStatus, CampaignState } from '../domain/enums/campaign.enums';
import { makeTeamWithVehicles, makeVehicleType } from '../domain/test-helpers';
import { Vehicle } from '../../team/domain/vehicle';

function makeFixture(campaignBudget: number, vehicleCount: number, isTeamEngaged = false) {
  const vehicle = new Vehicle(1, 9, makeVehicleType(), [], []);  // prix 12
  const newTeam = makeTeamWithVehicles(9, Array(vehicleCount).fill(vehicle));

  const member = new CampaignParticipant(2, 7, 3, false, ParticipantStatus.VALIDATED);
  const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_CONSTRUCTION, 'invite-code', [member], [], campaignBudget);

  const teamRepo: ITeamRepository = {
    findByIdForUser: vi.fn().mockResolvedValue(newTeam),
  } as unknown as ITeamRepository;

  const campaignRepo: ICampaignRepository = {
    isTeamEngaged: vi.fn().mockResolvedValue(isTeamEngaged),
    saveStructural: vi.fn().mockResolvedValue(undefined),
  } as unknown as ICampaignRepository;

  const replayService: CampaignReplayService = {
    loadAndReplay: vi.fn().mockResolvedValue(campaign),
  } as unknown as CampaignReplayService;

  const useCase = new ChangeMyTeamUseCase(campaignRepo, replayService, teamRepo);
  return { useCase, campaignRepo, member };
}

describe('ChangeMyTeamUseCase', () => {
  it('change l\'équipe quand elle tient dans le budget de la campagne', async () => {
    const { useCase, campaignRepo, member } = makeFixture(50, 1);  // coût 12 ≤ 50

    await useCase.execute({ campaignId: 1, userId: 7, teamId: 9 });

    expect(member.teamId).toBe(9);
    expect(campaignRepo.saveStructural).toHaveBeenCalled();
  });

  it('refuse une nouvelle équipe dont le coût dépasse le budget de la campagne', async () => {
    const { useCase, member } = makeFixture(20, 5);  // coût 60 > 20

    await expect(useCase.execute({ campaignId: 1, userId: 7, teamId: 9 })).rejects.toThrow(BadRequestException);
    expect(member.teamId).toBe(3);
  });

  it('refuse une équipe déjà engagée dans une autre campagne', async () => {
    const { useCase } = makeFixture(50, 1, true);

    await expect(useCase.execute({ campaignId: 1, userId: 7, teamId: 9 })).rejects.toThrow(ConflictException);
  });
});
