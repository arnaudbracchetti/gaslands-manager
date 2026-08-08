import { describe, it, expect, vi } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { CreateCampaignUseCase } from './create-campaign.usecase';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import type { ITeamRepository } from '../../team/domain/team.repository.interface';
import { makeTeamWithVehicles, makeVehicleType } from '../domain/test-helpers';
import { Vehicle } from '../../team/domain/vehicle';

function makeFixture(vehiclesCost: number, isTeamEngaged = false) {
  const vehicle = new Vehicle(1, 3, makeVehicleType(), [], []);
  // makeVehicleType() a un prix de 12 - on utilise plusieurs véhicules pour atteindre vehiclesCost.
  const vehicleCount = Math.max(1, Math.round(vehiclesCost / 12));
  const team = makeTeamWithVehicles(3, Array(vehicleCount).fill(vehicle));

  const teamRepo: ITeamRepository = {
    findByIdForUser: vi.fn().mockResolvedValue(team),
  } as unknown as ITeamRepository;

  const campaignRepo: ICampaignRepository = {
    isTeamEngaged: vi.fn().mockResolvedValue(isTeamEngaged),
    createCampaign: vi.fn().mockResolvedValue(1),
  } as unknown as ICampaignRepository;

  const useCase = new CreateCampaignUseCase(campaignRepo, teamRepo);
  return { useCase, teamRepo, campaignRepo, team };
}

describe('CreateCampaignUseCase', () => {
  it('crée la campagne avec le budget fourni', async () => {
    const { useCase, campaignRepo } = makeFixture(12);

    await useCase.execute({ userId: 42, name: 'Coupe Verney', teamId: 3, budget: 30 });

    expect(campaignRepo.createCampaign).toHaveBeenCalledWith('Coupe Verney', expect.any(String), 42, 3, 30);
  });

  it('applique le défaut 50 si aucun budget fourni', async () => {
    const { useCase, campaignRepo } = makeFixture(12);

    await useCase.execute({ userId: 42, name: 'Coupe Verney', teamId: 3 });

    expect(campaignRepo.createCampaign).toHaveBeenCalledWith('Coupe Verney', expect.any(String), 42, 3, 50);
  });

  it('crée sans équipe (organisateur sans équipe engagée)', async () => {
    const { useCase, campaignRepo, teamRepo } = makeFixture(12);

    await useCase.execute({ userId: 42, name: 'Coupe Verney' });

    expect(teamRepo.findByIdForUser).not.toHaveBeenCalled();
    expect(campaignRepo.createCampaign).toHaveBeenCalledWith('Coupe Verney', expect.any(String), 42, null, 50);
  });

  it('refuse si l\'équipe du créateur dépasse le budget choisi', async () => {
    const { useCase } = makeFixture(60);  // 5 véhicules à 12 = 60

    await expect(
      useCase.execute({ userId: 42, name: 'Coupe Verney', teamId: 3, budget: 50 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('refuse si l\'équipe est déjà engagée dans une autre campagne', async () => {
    const { useCase } = makeFixture(12, true);

    await expect(
      useCase.execute({ userId: 42, name: 'Coupe Verney', teamId: 3, budget: 50 }),
    ).rejects.toThrow(ConflictException);
  });
});
