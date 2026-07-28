import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CampaignController } from './campaign.controller';
import { User } from '../auth/domain/user';
import { UserRole } from '../auth/domain/user-role';

/**
 * Tests de câblage du CampaignController : chaque route traduit la requête HTTP en
 * commande et délègue au bon use case / query service. Aucune règle métier ici —
 * on vérifie uniquement la délégation et la recomposition de la réponse.
 */
// Vraie instance d'agrégat, comme ce que JwtStrategy dépose dans req.user :
// c'est son getter `callName` que le controller lit pour `playerName`.
const req = {
  user: new User(42, 'Jean', 'Dupont', 'JeanLeFou', 'u@x', 'hashed:x', UserRole.USER, true, new Date(), new Date()),
};

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
  let getWorkshopAvailableAdvantagesUseCase: ReturnType<typeof uc>;
  let getWorkshopAvailableSequellesUseCase: ReturnType<typeof uc>;
  let renameCampaignVehicleUseCase: ReturnType<typeof uc>;
  let getCampaignTeamSheetUseCase: ReturnType<typeof uc>;
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
      getJournal: vi.fn().mockResolvedValue(['journal']),
      getParticipantJournal: vi.fn().mockResolvedValue(['pjournal']),
    };
    scenarioCatalog = { getAll: vi.fn().mockReturnValue(['scen']) };
    createCampaignUseCase = uc(1);
    addGameUseCase = uc(7);
    recordResultUseCase = uc(undefined);
    validateParticipantUseCase = uc(undefined);
    getWorkshopAvailableAdvantagesUseCase = uc(['avantage']);
    getWorkshopAvailableSequellesUseCase = uc(['sequelle']);
    renameCampaignVehicleUseCase = uc(undefined);
    getCampaignTeamSheetUseCase = uc('<!doctype html>...');

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
      uc() as never,            // resetResult
      uc() as never,            // rollIncome
      uc() as never,            // getParticipantVehicles
      uc() as never,            // recordWallet
      uc() as never,            // recordVehicleLost
      uc() as never,            // contactResistance
      uc() as never,            // enterAtelier
      uc() as never,            // closeAtelier
      uc() as never,            // standings
      uc() as never,            // changeEquipment
      uc() as never,            // wreck
      uc() as never,            // workshop
      getCampaignTeamSheetUseCase as never,
      uc() as never,            // getWorkshopAvailableWeapons
      uc() as never,            // getWorkshopAvailableImprovements
      getWorkshopAvailableAdvantagesUseCase as never,
      getWorkshopAvailableSequellesUseCase as never,
      renameCampaignVehicleUseCase as never,
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

  it('getJournal délègue à query.getJournal(id, gameId, userId)', async () => {
    const result = await controller.getJournal(req as never, 1, 7);
    expect(query.getJournal).toHaveBeenCalledWith(1, 7, 42);
    expect(result).toEqual(['journal']);
  });

  it('getParticipantJournal délègue à query.getParticipantJournal(id, pid, userId)', async () => {
    const result = await controller.getParticipantJournal(req as never, 1, 5);
    expect(query.getParticipantJournal).toHaveBeenCalledWith(1, 5, 42);
    expect(result).toEqual(['pjournal']);
  });

  it('createGame exécute le use case puis recompose via query.getGame', async () => {
    const result = await controller.createGame(req as never, 1, { scenarioId: 's' });
    expect(addGameUseCase.execute).toHaveBeenCalledWith({
      campaignId: 1, userId: 42, scenarioId: 's', type: undefined,
    });
    expect(query.getGame).toHaveBeenCalledWith(1, 7);
    expect(result).toEqual({ id: 7, status: 'JOUE' });
  });

  it('recordResult exécute le use case puis recompose via query.getGame (ne finalise plus la partie elle-même)', async () => {
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

  it('getWorkshopAvailableAdvantages délègue au use case avec campaignId/vehicleId/userId', async () => {
    const result = await controller.getWorkshopAvailableAdvantages(req as never, 1, 5);
    expect(getWorkshopAvailableAdvantagesUseCase.execute).toHaveBeenCalledWith({
      campaignId: 1, vehicleId: 5, userId: 42,
    });
    expect(result).toEqual(['avantage']);
  });

  it('getWorkshopAvailableSequelles délègue au use case avec campaignId/vehicleId/userId', async () => {
    const result = await controller.getWorkshopAvailableSequelles(req as never, 1, 5);
    expect(getWorkshopAvailableSequellesUseCase.execute).toHaveBeenCalledWith({
      campaignId: 1, vehicleId: 5, userId: 42,
    });
    expect(result).toEqual(['sequelle']);
  });

  it('renameCampaignVehicle délègue au use case avec campaignId/vehicleId/nom/userId', async () => {
    await controller.renameCampaignVehicle(req as never, 1, { vehicleId: 5, nom: 'La Teigne' });
    expect(renameCampaignVehicleUseCase.execute).toHaveBeenCalledWith({
      campaignId: 1, userId: 42, vehicleId: 5, nom: 'La Teigne',
    });
  });

  it('getSheet délègue à GetCampaignTeamSheetUseCase avec campaignId/userId/playerName', async () => {
    const result = await controller.getSheet(req as never, 1);
    expect(getCampaignTeamSheetUseCase.execute).toHaveBeenCalledWith({
      campaignId: 1,
      userId: 42,
      playerName: 'JeanLeFou',
    });
    expect(result).toBe('<!doctype html>...');
  });

  it('getParticipantSheet résout le nom de la cible via query.getParticipant puis délègue au use case avec participantId', async () => {
    query.getParticipant.mockResolvedValueOnce({ id: 5, userName: 'Autre Joueur' });

    const result = await controller.getParticipantSheet(req as never, 1, 5);

    expect(query.getParticipant).toHaveBeenCalledWith(1, 5);
    expect(getCampaignTeamSheetUseCase.execute).toHaveBeenCalledWith({
      campaignId: 1,
      userId: 42,
      playerName: 'Autre Joueur',
      participantId: 5,
    });
    expect(result).toBe('<!doctype html>...');
  });
});
