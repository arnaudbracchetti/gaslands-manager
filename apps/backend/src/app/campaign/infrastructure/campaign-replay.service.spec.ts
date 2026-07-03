import { describe, it, expect, vi } from 'vitest';
import { CampaignReplayService } from './campaign-replay.service';
import { Campaign } from '../domain/campaign';
import { makeTestParticipant } from '../domain/test-helpers';
import { EvenementTeleGame } from '../domain/games/evenement-tele-game';
import { RankingAssignedEvent } from '../domain/events/ranking-assigned.event';
import { GameStatus } from '../domain/enums/game-status.enum';
import { CampaignState } from '../domain/enums/campaign.enums';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';

function makeGameWithPoints(participantId: number, points: number): EvenementTeleGame {
  const event = new RankingAssignedEvent(1, 10, participantId, 1, 1, points);
  return new EvenementTeleGame(10, 1, GameStatus.PLANIFIE, 1, 'scen', null, [event]);
}

/** Repo minimal : seul `findCampaign` est exercé par le replay service. */
function makeRepo(campaign: Campaign): ICampaignRepository {
  return {
    findCampaign: vi.fn().mockResolvedValue(campaign),
    appendEvents: vi.fn(),
    saveCampaign: vi.fn(),
    createCampaign: vi.fn(),
    saveStructural: vi.fn(),
    deleteCampaign: vi.fn(),
    isTeamEngaged: vi.fn(),
  } as unknown as ICampaignRepository;
}

function makeSeasonWithRepo(participantId: number, points: number): {
  repo: ICampaignRepository;
  service: CampaignReplayService;
  participant: ReturnType<typeof makeTestParticipant>['participant'];
} {
  const { participant } = makeTestParticipant(participantId);
  const game = makeGameWithPoints(participantId, points);
  const campaign = new Campaign(1, 'Campagne', CampaignState.EN_CONSTRUCTION, 'code', [participant], [game]);

  const repo = makeRepo(campaign);
  const service = new CampaignReplayService(repo);
  return { repo, service, participant };
}

describe('CampaignReplayService', () => {
  it('loadAndReplay appelle findCampaign puis replay', async () => {
    const { repo, service, participant } = makeSeasonWithRepo(1, 5);

    const result = await service.loadAndReplay(1);

    expect(repo.findCampaign).toHaveBeenCalledWith(1);
    expect(participant.championshipPoints).toBe(5);
    expect(result).toBeInstanceOf(Campaign);
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
    const campaign = new Campaign(1, 'Campagne', CampaignState.EN_CONSTRUCTION, 'code', [participant], [game]);

    const repo = makeRepo(campaign);
    const service = new CampaignReplayService(repo);

    await service.loadAndReplay(1);   // PC = 7
    await service.loadAndReplay(1);   // reset + replay → PC = 7 à nouveau

    expect(participant.championshipPoints).toBe(7);
  });
});
