import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { GetCampaignTeamSheetUseCase } from './get-campaign-team-sheet.usecase';
import type { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { Campaign } from '../domain/campaign';
import { CampaignParticipant } from '../domain/campaign-participant';
import { CampaignState } from '../domain/enums/campaign.enums';
import { makeTestParticipant } from '../domain/test-helpers';

function makeFixture() {
  const { participant, vehicle } = makeTestParticipant(1);
  const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_COURS, 'invite-code', [participant], []);
  const replayService: CampaignReplayService = {
    loadAndReplay: vi.fn().mockResolvedValue(campaign),
  } as unknown as CampaignReplayService;
  const useCase = new GetCampaignTeamSheetUseCase(replayService);
  return { useCase, vehicle, campaign };
}

describe('GetCampaignTeamSheetUseCase', () => {
  it('génère la fiche HTML pour le participant courant', async () => {
    const { useCase } = makeFixture();

    const html = await useCase.execute({ campaignId: 1, userId: 42 });

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Rutherford');
  });

  it('reflète les chocs réels accumulés en campagne (jamais visibles depuis la lecture équipe directe)', async () => {
    const { useCase, vehicle } = makeFixture();
    vehicle.addChocs(3);

    const html = await useCase.execute({ campaignId: 1, userId: 42 });

    expect(html).toContain('Chocs : 3');
  });

  it('rejette avec NotFoundException si l\'utilisateur n\'est pas participant', async () => {
    const { participant } = makeTestParticipant(1);
    const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_COURS, 'invite-code', [participant], []);
    const replayService: CampaignReplayService = {
      loadAndReplay: vi.fn().mockResolvedValue(campaign),
    } as unknown as CampaignReplayService;
    const useCase = new GetCampaignTeamSheetUseCase(replayService);

    await expect(useCase.execute({ campaignId: 1, userId: 999 })).rejects.toThrow(NotFoundException);
  });

  it('rejette avec NotFoundException si le participant n\'a pas d\'équipe attachée', async () => {
    const participant = new CampaignParticipant(1, 42, null, false);
    const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_COURS, 'invite-code', [participant], []);
    const replayService: CampaignReplayService = {
      loadAndReplay: vi.fn().mockResolvedValue(campaign),
    } as unknown as CampaignReplayService;
    const useCase = new GetCampaignTeamSheetUseCase(replayService);

    await expect(useCase.execute({ campaignId: 1, userId: 42 })).rejects.toThrow(NotFoundException);
  });
});
