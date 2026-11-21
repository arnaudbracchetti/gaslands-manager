import { describe, it, expect, vi } from 'vitest';
import { RollIncomeUseCase } from './roll-income.usecase';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import type { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import type { IRandomizer } from '../domain/randomizer.interface';
import { Campaign } from '../domain/campaign';
import { CampaignParticipant } from '../domain/campaign-participant';
import { EscarmoucheGame } from '../domain/games/escarmouche-game';
import { GameStatus } from '../domain/enums/game-status.enum';
import { CampaignState } from '../domain/enums/campaign.enums';
import { WalletMovementEvent } from '../domain/events/wallet-movement.event';
import { WalletReason } from '../domain/enums/wallet-reason.enum';
import { HouseRules } from '../domain/house-rules/house-rules';

class FixedRandomizer implements IRandomizer {
  constructor(private readonly fixedRoll: number) {}
  roll(): number { return this.fixedRoll; }
  pick<T>(pool: T[]): T { return pool[0]; }
}

function makeFixture(
  randomizer: IRandomizer,
  houseRules: HouseRules = HouseRules.none(),
): {
  useCase: RollIncomeUseCase;
  campaignRepo: ICampaignRepository;
  game: EscarmoucheGame;
} {
  const organizer = new CampaignParticipant(1, 42, 1, true);
  const game = new EscarmoucheGame(10, 1, GameStatus.PLANIFIE, 1, 'embuscade', null, []);
  const campaign = new Campaign(
    1,
    'Campagne Test',
    CampaignState.EN_COURS,
    'invite-code',
    [organizer],
    [game],
    50,
    houseRules,
  );

  const campaignRepo: ICampaignRepository = {
    appendEvents: vi.fn().mockResolvedValue(undefined),
  } as unknown as ICampaignRepository;
  const replayService: CampaignReplayService = {
    loadAndReplay: vi.fn().mockResolvedValue(campaign),
  } as unknown as CampaignReplayService;

  const useCase = new RollIncomeUseCase(campaignRepo, replayService, randomizer);
  return { useCase, campaignRepo, game };
}

describe('RollIncomeUseCase', () => {
  it('crédite le D6 tiré en jerricans et retourne le montant', async () => {
    const { useCase } = makeFixture(new FixedRandomizer(4));
    const result = await useCase.execute({ campaignId: 1, gameId: 10, userId: 42, participantId: 1 });
    expect(result.amount).toBe(4);
    expect(result.descriptions).toHaveLength(1);
  });

  it('persiste un WalletMovementEvent RECOMPENSE via appendEvents', async () => {
    const { useCase, campaignRepo } = makeFixture(new FixedRandomizer(6));
    await useCase.execute({ campaignId: 1, gameId: 10, userId: 42, participantId: 1 });
    expect(campaignRepo.appendEvents).toHaveBeenCalledWith(10, [
      expect.objectContaining({ participantId: 1, amount: 6, reason: WalletReason.RECOMPENSE }),
    ]);
  });

  it('journalise réellement l\'événement sur la partie', async () => {
    const { useCase, game } = makeFixture(new FixedRandomizer(3));
    await useCase.execute({ campaignId: 1, gameId: 10, userId: 42, participantId: 1 });
    expect(game.events).toHaveLength(1);
    expect(game.events[0]).toBeInstanceOf(WalletMovementEvent);
  });

  it('refuse un utilisateur non organisateur', async () => {
    const { useCase } = makeFixture(new FixedRandomizer(3));
    await expect(
      useCase.execute({ campaignId: 1, gameId: 10, userId: 999, participantId: 1 }),
    ).rejects.toThrow();
  });

  it('règle maison escarmouche_bonus_jerricans active — ne crédite rien et ne journalise rien', async () => {
    const { useCase, campaignRepo, game } = makeFixture(
      new FixedRandomizer(4),
      HouseRules.fromPersisted(['escarmouche_bonus_jerricans']),
    );

    const result = await useCase.execute({ campaignId: 1, gameId: 10, userId: 42, participantId: 1 });

    expect(result).toEqual({ amount: 0, descriptions: [] });
    expect(campaignRepo.appendEvents).toHaveBeenCalledWith(10, []);
    expect(game.events).toHaveLength(0);
  });
});
