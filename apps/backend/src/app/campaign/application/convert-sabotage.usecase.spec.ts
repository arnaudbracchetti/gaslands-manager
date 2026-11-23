import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ConvertSabotageUseCase } from './convert-sabotage.usecase';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import type { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { Campaign } from '../domain/campaign';
import { CampaignParticipant } from '../domain/campaign-participant';
import { EvenementTeleGame } from '../domain/games/evenement-tele-game';
import { GameStatus } from '../domain/enums/game-status.enum';
import { CampaignState } from '../domain/enums/campaign.enums';
import { SabotageConvertedEvent } from '../domain/events/sabotage-converted.event';
import { HouseRules } from '../domain/house-rules/house-rules';

function makeFixture(
  houseRules: HouseRules,
  resistancePoints: number,
): { useCase: ConvertSabotageUseCase; campaignRepo: ICampaignRepository } {
  const participant = new CampaignParticipant(1, 42, 1, true);
  participant.addResistance(resistancePoints);
  const game = new EvenementTeleGame(
    10,
    1,
    GameStatus.ATELIER,
    1,
    'arene',
    new Date(),
    [],
  );
  const campaign = new Campaign(
    1,
    'Campagne Test',
    CampaignState.EN_COURS,
    'invite-code',
    [participant],
    [game],
    50,
    houseRules,
  );

  const campaignRepo = {
    appendEvents: vi.fn().mockResolvedValue(undefined),
  } as unknown as ICampaignRepository;
  const replayService = {
    loadAndReplay: vi.fn().mockResolvedValue(campaign),
  } as unknown as CampaignReplayService;
  return {
    useCase: new ConvertSabotageUseCase(campaignRepo, replayService),
    campaignRepo,
  };
}

const RULE_ON = HouseRules.fromPersisted(['conversion_sabotage_jerricans']);

describe('ConvertSabotageUseCase', () => {
  it('persiste un SabotageConvertedEvent (1 jeton → 3 jerricans) quand la règle est active', async () => {
    const { useCase, campaignRepo } = makeFixture(RULE_ON, 6);

    await useCase.execute({ campaignId: 1, userId: 42 });

    expect(campaignRepo.appendEvents).toHaveBeenCalledWith(10, [
      expect.any(SabotageConvertedEvent),
    ]);
    const [, events] = (campaignRepo.appendEvents as ReturnType<typeof vi.fn>)
      .mock.calls[0];
    expect(events[0]).toMatchObject({ tokensConverted: 1, jerricansGained: 3 });
  });

  it('traduit le refus « règle désactivée » en BadRequestException, sans rien persister', async () => {
    const { useCase, campaignRepo } = makeFixture(HouseRules.none(), 6);

    await expect(
      useCase.execute({ campaignId: 1, userId: 42 }),
    ).rejects.toThrow(BadRequestException);
    expect(campaignRepo.appendEvents).not.toHaveBeenCalled();
  });

  it('traduit le refus « solde de jetons nul » en BadRequestException', async () => {
    const { useCase, campaignRepo } = makeFixture(RULE_ON, 0);

    await expect(
      useCase.execute({ campaignId: 1, userId: 42 }),
    ).rejects.toThrow(BadRequestException);
    expect(campaignRepo.appendEvents).not.toHaveBeenCalled();
  });
});
