import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CampaignController } from './campaign.controller';

/**
 * Tests de câblage du CampaignController : chaque route traduit la requête HTTP en
 * commande et délègue au bon use case / query service. Aucune règle métier ici —
 * on vérifie uniquement la délégation et la recomposition de la réponse.
 */
const req = { user: { id: 42, email: 'u@x' } };

// Fabrique un mock de use case (objet avec execute()).
function uc(returnValue?: unknown): { execute: ReturnType<typeof vi.fn> } {
  return { execute: vi.fn().mockResolvedValue(returnValue) };
}

describe('CampaignController (câblage)', () => {
  let query: Record<string, ReturnType<typeof vi.fn>>;
  let scenarioCatalog: { getAll: ReturnType<typeof vi.fn> };
  let createCampaignUseCase: ReturnType<typeof uc>;
  let addGameUseCase: ReturnType<typeof uc>;
  let recordResultUseCase: ReturnType<typeof uc>;
  let validateParticipantUseCase: ReturnType<typeof uc>;
  let controller: CampaignController;

  beforeEach(() => {
    query = {
      findAll: vi.fn().mockResolvedValue(['campaigns']),
      findOne: vi.fn().mockResolvedValue({ id: 1 }),
      findByInviteCode: vi.fn(),
      findPendingForUser: vi.fn(),
      findOrganizedWithPendingRequests: vi.fn(),
      findParticipants: vi.fn(),
      getParticipant: vi.fn().mockResolvedValue({ id: 5 }),
      findGames: vi.fn(),
      getGame: vi.fn().mockResolvedValue({ id: 7, status: 'JOUE' }),
      getResults: vi.fn(),
    };
    scenarioCatalog = { getAll: vi.fn().mockReturnValue(['scen']) };
    createCampaignUseCase = uc(1);
    addGameUseCase = uc(7);
    recordResultUseCase = uc(undefined);
    validateParticipantUseCase = uc(undefined);

    controller = new CampaignController(
      query as never,
      scenarioCatalog as never,
      createCampaignUseCase as never,
      uc() as never,            // changeState
      uc() as never,            // delete
      uc(5) as never,           // requestJoin
      validateParticipantUseCase as never,
      uc() as never,            // promote
      uc() as never,            // removeParticipant
      uc(5) as never,           // changeMyTeam
      addGameUseCase as never,
      uc(7) as never,           // updateGame
      uc() as never,            // removeGame
      recordResultUseCase as never,
      uc() as never,            // recordRanking
      uc() as never,            // recordWallet
      uc() as never,            // recordVehicleLost
      uc() as never,            // contactResistance
      uc() as never,            // finalize
      uc() as never,            // standings
      uc() as never,            // changeEquipment
      uc() as never,            // wreck
      uc() as never,            // sequella
      uc() as never,            // workshop
    );
  });

  it('getScenarios délègue au catalogue de scénarios (public)', () => {
    expect(controller.getScenarios()).toEqual(['scen']);
    expect(scenarioCatalog.getAll).toHaveBeenCalled();
  });

  it('getAll délègue à query.findAll(userId)', async () => {
    await controller.getAll(req as never);
    expect(query.findAll).toHaveBeenCalledWith(42);
  });

  it('create exécute le use case puis recompose via query.findOne', async () => {
    const result = await controller.create(req as never, { name: 'C', teamId: 3 });
    expect(createCampaignUseCase.execute).toHaveBeenCalledWith({ userId: 42, name: 'C', teamId: 3 });
    expect(query.findOne).toHaveBeenCalledWith(1, 42);
    expect(result).toEqual({ id: 1 });
  });

  it('createGame exécute le use case puis recompose via query.getGame', async () => {
    const result = await controller.createGame(req as never, 1, { scenarioId: 's' });
    expect(addGameUseCase.execute).toHaveBeenCalledWith({
      campaignId: 1, userId: 42, scenarioId: 's', type: undefined,
    });
    expect(query.getGame).toHaveBeenCalledWith(1, 7);
    expect(result).toEqual({ id: 7, status: 'JOUE' });
  });

  it('recordResult exécute le use case puis retourne la partie JOUE', async () => {
    const result = await controller.recordResult(req as never, 1, 7, { results: [{ participantId: 1, rank: 1 }] });
    expect(recordResultUseCase.execute).toHaveBeenCalledWith({
      campaignId: 1, gameId: 7, userId: 42, results: [{ participantId: 1, rank: 1 }],
    });
    expect(query.getGame).toHaveBeenCalledWith(1, 7);
    expect(result).toEqual({ id: 7, status: 'JOUE' });
  });

  it('validateParticipant exécute le use case puis recompose via query.getParticipant', async () => {
    await controller.validateParticipant(req as never, 1, 5, { accept: true });
    expect(validateParticipantUseCase.execute).toHaveBeenCalledWith({
      campaignId: 1, pid: 5, userId: 42, accept: true,
    });
    expect(query.getParticipant).toHaveBeenCalledWith(1, 5);
  });
});
