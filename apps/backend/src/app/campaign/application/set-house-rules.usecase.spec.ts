import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { SetHouseRulesUseCase } from './set-house-rules.usecase';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import type { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import type { HouseRuleCatalogService } from '../house-rule-catalog.service';
import { Campaign } from '../domain/campaign';
import { CampaignParticipant } from '../domain/campaign-participant';
import { CampaignState } from '../domain/enums/campaign.enums';

function makeFixture(state: CampaignState) {
  const organizer = new CampaignParticipant(1, 42, 1, true);
  const campaign = new Campaign(1, 'Campagne Test', state, 'invite-code', [organizer], [], 50);

  const campaignRepo: ICampaignRepository = {
    saveStructural: vi.fn().mockResolvedValue(undefined),
  } as unknown as ICampaignRepository;

  const replayService: CampaignReplayService = {
    loadAndReplay: vi.fn().mockResolvedValue(campaign),
  } as unknown as CampaignReplayService;

  const houseRuleCatalog: HouseRuleCatalogService = {
    validKeys: vi.fn().mockReturnValue(['distribution_points_resistance']),
  } as unknown as HouseRuleCatalogService;

  const useCase = new SetHouseRulesUseCase(campaignRepo, replayService, houseRuleCatalog);
  return { useCase, campaignRepo, campaign };
}

describe('SetHouseRulesUseCase', () => {
  it('active une règle valide et persiste, même en EN_COURS (aucune contrainte d\'état)', async () => {
    const { useCase, campaignRepo, campaign } = makeFixture(CampaignState.EN_COURS);

    await useCase.execute({ campaignId: 1, userId: 42, houseRules: ['distribution_points_resistance'] });

    expect(campaign.houseRules.isEnabled('distribution_points_resistance')).toBe(true);
    expect(campaignRepo.saveStructural).toHaveBeenCalledWith(campaign);
  });

  it('fonctionne aussi en TERMINEE (aucune contrainte d\'état)', async () => {
    const { useCase, campaignRepo } = makeFixture(CampaignState.TERMINEE);

    await useCase.execute({ campaignId: 1, userId: 42, houseRules: [] });

    expect(campaignRepo.saveStructural).toHaveBeenCalled();
  });

  it('refuse un utilisateur non organisateur', async () => {
    const { useCase } = makeFixture(CampaignState.EN_CONSTRUCTION);

    await expect(
      useCase.execute({ campaignId: 1, userId: 999, houseRules: [] }),
    ).rejects.toThrow();
  });

  it('refuse une clé absente du catalogue (DomainException → BadRequestException), sans persister', async () => {
    const { useCase, campaignRepo } = makeFixture(CampaignState.EN_CONSTRUCTION);

    await expect(
      useCase.execute({ campaignId: 1, userId: 42, houseRules: ['clef_inconnue'] }),
    ).rejects.toThrow(BadRequestException);
    expect(campaignRepo.saveStructural).not.toHaveBeenCalled();
  });
});
