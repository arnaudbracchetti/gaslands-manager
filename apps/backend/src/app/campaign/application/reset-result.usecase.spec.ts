import { describe, it, expect, vi } from 'vitest';
import { ResetResultUseCase } from './reset-result.usecase';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import type { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { Campaign } from '../domain/campaign';
import { CampaignParticipant } from '../domain/campaign-participant';
import { EvenementTeleGame } from '../domain/games/evenement-tele-game';
import { GameStatus } from '../domain/enums/game-status.enum';
import { CampaignState } from '../domain/enums/campaign.enums';
import { RankingAssignedEvent } from '../domain/events/ranking-assigned.event';
import { ResistanceContactedEvent } from '../domain/events/resistance-contacted.event';

function makeFixture(status: GameStatus): {
  useCase: ResetResultUseCase;
  campaignRepo: ICampaignRepository;
} {
  const organizer = new CampaignParticipant(1, 42, 1, true);
  const events = [
    new RankingAssignedEvent(101, 10, 1, 0, 1, 10),
    new ResistanceContactedEvent(102, 10, 1, 1),
  ];
  const game = new EvenementTeleGame(10, 1, status, 1, 'scen', status === GameStatus.PLANIFIE ? null : new Date(), events);
  const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_COURS, 'invite-code', [organizer], [game]);

  const campaignRepo: ICampaignRepository = {
    deleteEvents: vi.fn().mockResolvedValue(undefined),
  } as unknown as ICampaignRepository;
  const replayService: CampaignReplayService = {
    load: vi.fn().mockResolvedValue(campaign),
  } as unknown as CampaignReplayService;

  const useCase = new ResetResultUseCase(campaignRepo, replayService);
  return { useCase, campaignRepo };
}

describe('ResetResultUseCase', () => {
  it('supprime tous les événements de la partie PLANIFIE en une seule opération', async () => {
    const { useCase, campaignRepo } = makeFixture(GameStatus.PLANIFIE);
    await useCase.execute({ campaignId: 1, gameId: 10, userId: 42 });
    expect(campaignRepo.deleteEvents).toHaveBeenCalledWith([101, 102]);
  });

  it('ne fait rien si la partie n\'a aucun événement', async () => {
    const organizer = new CampaignParticipant(1, 42, 1, true);
    const game = new EvenementTeleGame(10, 1, GameStatus.PLANIFIE, 1, 'scen', null, []);
    const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_COURS, 'invite-code', [organizer], [game]);
    const campaignRepo: ICampaignRepository = {
      deleteEvents: vi.fn().mockResolvedValue(undefined),
    } as unknown as ICampaignRepository;
    const replayService = { load: vi.fn().mockResolvedValue(campaign) } as unknown as CampaignReplayService;

    await new ResetResultUseCase(campaignRepo, replayService).execute({ campaignId: 1, gameId: 10, userId: 42 });
    expect(campaignRepo.deleteEvents).not.toHaveBeenCalled();
  });

  it('refuse une partie déjà en ATELIER', async () => {
    const { useCase } = makeFixture(GameStatus.ATELIER);
    await expect(useCase.execute({ campaignId: 1, gameId: 10, userId: 42 })).rejects.toThrow(
      'réinitialisée',
    );
  });

  it('refuse un utilisateur non organisateur', async () => {
    const { useCase } = makeFixture(GameStatus.PLANIFIE);
    await expect(useCase.execute({ campaignId: 1, gameId: 10, userId: 999 })).rejects.toThrow();
  });
});
