import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { UpdateCampaignUseCase } from './update-campaign.usecase';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import type { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { Campaign } from '../domain/campaign';
import { CampaignParticipant } from '../domain/campaign-participant';
import { CampaignState } from '../domain/enums/campaign.enums';
import { makeTestParticipant } from '../domain/test-helpers';

function makeFixture(state: CampaignState, participants: CampaignParticipant[] = []) {
  const organizer = new CampaignParticipant(1, 42, 1, true);
  const campaign = new Campaign(1, 'Campagne Test', state, 'invite-code', [organizer, ...participants], [], 50);

  const campaignRepo: ICampaignRepository = {
    saveStructural: vi.fn().mockResolvedValue(undefined),
  } as unknown as ICampaignRepository;

  const replayService: CampaignReplayService = {
    loadAndReplay: vi.fn().mockResolvedValue(campaign),
  } as unknown as CampaignReplayService;

  const useCase = new UpdateCampaignUseCase(campaignRepo, replayService);
  return { useCase, campaignRepo, campaign };
}

describe('UpdateCampaignUseCase', () => {
  it('modifie nom et budget, puis persiste (EN_CONSTRUCTION, organisateur)', async () => {
    const { useCase, campaignRepo, campaign } = makeFixture(CampaignState.EN_CONSTRUCTION);

    await useCase.execute({ campaignId: 1, userId: 42, name: 'Coupe Verney', budget: 30 });

    expect(campaign.name).toBe('Coupe Verney');
    expect(campaign.budget).toBe(30);
    expect(campaignRepo.saveStructural).toHaveBeenCalledWith(campaign);
  });

  it('refuse un utilisateur non organisateur', async () => {
    const { useCase } = makeFixture(CampaignState.EN_CONSTRUCTION);

    await expect(
      useCase.execute({ campaignId: 1, userId: 999, name: 'Coupe Verney', budget: 30 }),
    ).rejects.toThrow();
  });

  it('refuse la modification hors EN_CONSTRUCTION (DomainException → BadRequestException)', async () => {
    const { useCase, campaignRepo } = makeFixture(CampaignState.EN_COURS);

    await expect(
      useCase.execute({ campaignId: 1, userId: 42, name: 'Coupe Verney', budget: 30 }),
    ).rejects.toThrow(BadRequestException);
    expect(campaignRepo.saveStructural).not.toHaveBeenCalled();
  });

  it('refuse un budget qui rendrait une équipe déjà engagée illégale', async () => {
    const { participant } = makeTestParticipant(2);  // VALIDATED, équipe de coût 21
    const { useCase, campaignRepo } = makeFixture(CampaignState.EN_CONSTRUCTION, [participant]);

    await expect(
      useCase.execute({ campaignId: 1, userId: 42, name: 'Coupe Verney', budget: 20 }),
    ).rejects.toThrow(BadRequestException);
    expect(campaignRepo.saveStructural).not.toHaveBeenCalled();
  });
});
