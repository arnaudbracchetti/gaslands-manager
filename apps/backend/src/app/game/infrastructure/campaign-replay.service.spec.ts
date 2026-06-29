import { describe, it, expect, vi } from 'vitest';
import { CampaignReplayService } from './campaign-replay.service';
import { Season } from '../domain/season';
import { makeTestParticipant } from '../domain/test-helpers';
import { EvenementTeleGame } from '../domain/games/evenement-tele-game';
import { RankingAssignedEvent } from '../domain/events/ranking-assigned.event';
import { GameStatus } from '../domain/enums/game-status.enum';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';

function makeGameWithPoints(participantId: number, points: number): EvenementTeleGame {
  const event = new RankingAssignedEvent(1, 10, participantId, 1, 1, points);
  return new EvenementTeleGame(10, 1, GameStatus.PLANIFIE, 1, 'scen', null, [event]);
}

function makeSeasonWithRepo(participantId: number, points: number): {
  repo: ICampaignRepository;
  service: CampaignReplayService;
  participant: ReturnType<typeof makeTestParticipant>['participant'];
} {
  const { participant } = makeTestParticipant(participantId);
  const game = makeGameWithPoints(participantId, points);
  const season = new Season(1, [participant], [game]);

  const repo: ICampaignRepository = {
    findCampaign: vi.fn().mockResolvedValue(season),
    appendEvents: vi.fn(),
    saveSeason: vi.fn(),
  };

  const service = new CampaignReplayService(repo);
  return { repo, service, participant };
}

describe('CampaignReplayService', () => {
  it('loadAndReplay appelle findCampaign puis replay', async () => {
    const { repo, service, participant } = makeSeasonWithRepo(1, 5);

    const result = await service.loadAndReplay(1);

    expect(repo.findCampaign).toHaveBeenCalledWith(1);
    expect(participant.championshipPoints).toBe(5);
    expect(result).toBeInstanceOf(Season);
  });

  it('load retourne la saison sans rejouer', async () => {
    const { repo, service, participant } = makeSeasonWithRepo(1, 5);

    await service.load(1);

    expect(repo.findCampaign).toHaveBeenCalledWith(1);
    expect(participant.championshipPoints).toBe(0); // replay non appelé
  });

  it('loadAndReplay replay idempotent : deux appels → même état', async () => {
    const { participant } = makeTestParticipant(1);
    const game = makeGameWithPoints(1, 7);
    const season = new Season(1, [participant], [game]);

    const repo: ICampaignRepository = {
      findCampaign: vi.fn()
        .mockResolvedValueOnce(season)
        .mockResolvedValueOnce(season),
      appendEvents: vi.fn(),
      saveSeason: vi.fn(),
    };

    const service = new CampaignReplayService(repo);

    await service.loadAndReplay(1);   // PC = 7
    await service.loadAndReplay(1);   // reset + replay → PC = 7 à nouveau

    expect(participant.championshipPoints).toBe(7);
  });
});
