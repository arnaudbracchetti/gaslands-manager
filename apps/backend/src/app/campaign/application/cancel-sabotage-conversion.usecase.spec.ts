import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { CancelSabotageConversionUseCase } from './cancel-sabotage-conversion.usecase';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import type { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { Campaign } from '../domain/campaign';
import { EvenementTeleGame } from '../domain/games/evenement-tele-game';
import { GameStatus } from '../domain/enums/game-status.enum';
import { CampaignState } from '../domain/enums/campaign.enums';
import { SabotageConvertedEvent } from '../domain/events/sabotage-converted.event';
import { makeTestParticipant } from '../domain/test-helpers';

function makeFixture(spentJerricans: number): { useCase: CancelSabotageConversionUseCase; campaignRepo: ICampaignRepository } {
  const { participant } = makeTestParticipant(1); // wallet 29
  participant.creditWallet(3);                    // effet rejoué de la conversion
  participant.creditWallet(-spentJerricans);      // jerricans dépensés depuis (achats)
  const game = new EvenementTeleGame(10, 1, GameStatus.ATELIER, 1, 'arene', new Date(), [
    new SabotageConvertedEvent(500, 10, 1, 1, 1, 3),
  ]);
  const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_COURS, 'invite-code', [participant], [game]);
  const campaignRepo = { deleteEvents: vi.fn().mockResolvedValue(undefined) } as unknown as ICampaignRepository;
  const replayService = { loadAndReplay: vi.fn().mockResolvedValue(campaign) } as unknown as CampaignReplayService;
  return { useCase: new CancelSabotageConversionUseCase(campaignRepo, replayService), campaignRepo };
}

describe('CancelSabotageConversionUseCase', () => {
  it('supprime l\'événement de conversion quand la cagnotte couvre l\'annulation', async () => {
    const { useCase, campaignRepo } = makeFixture(0);

    await useCase.execute({ campaignId: 1, userId: 42 });

    expect(campaignRepo.deleteEvents).toHaveBeenCalledWith([500]);
  });

  it('traduit le refus « cagnotte insuffisante » en BadRequestException, sans rien supprimer', async () => {
    const { useCase, campaignRepo } = makeFixture(31); // wallet 32 - 31 = 1 < 3

    await expect(useCase.execute({ campaignId: 1, userId: 42 })).rejects.toThrow(BadRequestException);
    expect(campaignRepo.deleteEvents).not.toHaveBeenCalled();
  });
});
