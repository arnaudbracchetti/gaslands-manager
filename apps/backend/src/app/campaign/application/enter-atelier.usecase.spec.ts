import { describe, it, expect, vi } from 'vitest';
import { EnterAtelierUseCase } from './enter-atelier.usecase';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import type { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { Campaign } from '../domain/campaign';
import { CampaignParticipant } from '../domain/campaign-participant';
import { EvenementTeleGame } from '../domain/games/evenement-tele-game';
import { EscarmoucheGame } from '../domain/games/escarmouche-game';
import { GameStatus } from '../domain/enums/game-status.enum';
import { CampaignState, ParticipantStatus } from '../domain/enums/campaign.enums';
import { RankingAssignedEvent } from '../domain/events/ranking-assigned.event';
import { ResistanceContactedEvent } from '../domain/events/resistance-contacted.event';

function makeFixture(game: EvenementTeleGame | EscarmoucheGame): {
  useCase: EnterAtelierUseCase;
  campaignRepo: ICampaignRepository;
  callOrder: string[];
} {
  const p1 = new CampaignParticipant(1, 42, 1, true, ParticipantStatus.VALIDATED);
  const p2 = new CampaignParticipant(2, 7, 3, false, ParticipantStatus.VALIDATED);
  const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_COURS, 'invite-code', [p1, p2], [game]);

  const callOrder: string[] = [];
  const campaignRepo: ICampaignRepository = {
    appendEvents: vi.fn().mockImplementation(async () => { callOrder.push('appendEvents'); }),
    saveCampaign: vi.fn().mockImplementation(async () => { callOrder.push('saveCampaign'); }),
  } as unknown as ICampaignRepository;
  const replayService: CampaignReplayService = {
    loadAndReplay: vi.fn().mockResolvedValue(campaign),
  } as unknown as CampaignReplayService;

  const useCase = new EnterAtelierUseCase(campaignRepo, replayService);
  return { useCase, campaignRepo, callOrder };
}

describe('EnterAtelierUseCase — distribution des Points de Résistance (RM-4)', () => {
  it('distribue les PR automatiques puis persiste le journal AVANT le statut', async () => {
    const game = new EvenementTeleGame(10, 1, GameStatus.PLANIFIE, 1, 'scen', null, []);
    game.recordResult([
      { participantId: 1, rank: 1 },
      { participantId: 2, rank: 2 },
    ], [
      new CampaignParticipant(1, 42, 1, true, ParticipantStatus.VALIDATED),
      new CampaignParticipant(2, 7, 3, false, ParticipantStatus.VALIDATED),
    ]);
    const { useCase, campaignRepo, callOrder } = makeFixture(game);

    const result = await useCase.execute({ campaignId: 1, gameId: 10, userId: 42 });

    expect(campaignRepo.appendEvents).toHaveBeenCalledWith(10, [
      expect.objectContaining({ participantId: 2, strategyKey: 'defaut' }),
    ]);
    expect(campaignRepo.saveCampaign).toHaveBeenCalledTimes(1);
    // Ordre de persistance : journal AVANT statut.
    expect(callOrder).toEqual(['appendEvents', 'saveCampaign']);
    expect(game.status).toBe(GameStatus.ATELIER);
    expect(game.events.filter((e) => e instanceof ResistanceContactedEvent)).toHaveLength(1);
    expect(result).toEqual({ autoClosedGameId: null });
  });

  it("garde d'idempotence — un second appel ne recrée rien mais fait quand même basculer le statut", async () => {
    const game = new EvenementTeleGame(10, 1, GameStatus.PLANIFIE, 1, 'scen', null, [
      new RankingAssignedEvent(1, 10, 2, 1, 2, 0),
      // Distribution déjà journalisée (rejeu après un échec précédent de saveCampaign).
      new ResistanceContactedEvent(2, 10, 2, 2, 'defaut'),
    ]);
    const { useCase, campaignRepo } = makeFixture(game);

    const result = await useCase.execute({ campaignId: 1, gameId: 10, userId: 42 });

    expect(campaignRepo.appendEvents).not.toHaveBeenCalled();
    expect(campaignRepo.saveCampaign).toHaveBeenCalledTimes(1);
    expect(game.status).toBe(GameStatus.ATELIER);
    expect(result).toEqual({ autoClosedGameId: null });
  });

  it('ne distribue jamais de PR pour une Escarmouche (hook no-op)', async () => {
    const game = new EscarmoucheGame(10, 1, GameStatus.PLANIFIE, 1, 'scen', null, []);
    const { useCase, campaignRepo } = makeFixture(game);

    await useCase.execute({ campaignId: 1, gameId: 10, userId: 42 });

    expect(campaignRepo.appendEvents).not.toHaveBeenCalled();
    expect(campaignRepo.saveCampaign).toHaveBeenCalledTimes(1);
    expect(game.status).toBe(GameStatus.ATELIER);
  });

  it("une partie déjà hors PLANIFIE rejette AVANT toute persistance (ni journal, ni statut)", async () => {
    const game = new EvenementTeleGame(10, 1, GameStatus.ATELIER, 1, 'scen', null, []);
    const { useCase, campaignRepo } = makeFixture(game);

    await expect(useCase.execute({ campaignId: 1, gameId: 10, userId: 42 })).rejects.toThrow(
      'Seule une partie PLANIFIE peut entrer en atelier.',
    );
    expect(campaignRepo.appendEvents).not.toHaveBeenCalled();
    expect(campaignRepo.saveCampaign).not.toHaveBeenCalled();
  });

  it('refuse un appelant non organisateur', async () => {
    const game = new EvenementTeleGame(10, 1, GameStatus.PLANIFIE, 1, 'scen', null, []);
    const { useCase, campaignRepo } = makeFixture(game);

    await expect(useCase.execute({ campaignId: 1, gameId: 10, userId: 999 })).rejects.toThrow();
    expect(campaignRepo.appendEvents).not.toHaveBeenCalled();
    expect(campaignRepo.saveCampaign).not.toHaveBeenCalled();
  });
});
