/**
 * Tests unitaires pour GameController.
 *
 * Vérifie le câblage HTTP : chaque endpoint appelle la bonne méthode du service
 * avec req.user.id et les paramètres de route (cf. season.controller.spec.ts).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { ScenarioCatalogService } from './scenario-catalog.service';
import { GameResultService } from './game-result.service';
import { GameType } from './game.enums';
import { WalletReason } from './domain/enums/wallet-reason.enum';
import { RecordRankingUseCase } from './application/record-ranking.usecase';
import { RecordWalletMovementUseCase } from './application/record-wallet-movement.usecase';
import { RecordVehicleLostUseCase } from './application/record-vehicle-lost.usecase';
import { ContactResistanceUseCase } from './application/contact-resistance.usecase';
import { FinalizeGameUseCase } from './application/finalize-game.usecase';
import { GetStandingsUseCase } from './application/get-standings.usecase';
import { ChangeEquipmentUseCase } from './application/change-equipment.usecase';
import { WreckResolveUseCase } from './application/wreck-resolve.usecase';
import { AddSequellaUseCase } from './application/add-sequella.usecase';
import { CampaignReplayService } from './infrastructure/campaign-replay.service';

const mockRequest = { user: { id: 42, email: 'test@test.com' } };

describe('GameController', () => {
  let controller: GameController;
  let gameResultService: GameResultService;

  const mockGameService = {
    findAllForCampaign: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  const mockScenarioCatalog = {
    getAll: vi.fn(),
  };

  const mockGameResultService = {
    recordResult: vi.fn(),
    getResults: vi.fn(),
  };

  const mockRecordRanking = { execute: vi.fn() };
  const mockRecordWallet = { execute: vi.fn() };
  const mockRecordVehicleLost = { execute: vi.fn() };
  const mockContactResistance = { execute: vi.fn() };
  const mockFinalizeGame = { execute: vi.fn() };
  const mockGetStandings = { execute: vi.fn() };
  const mockChangeEquipment = { execute: vi.fn() };
  const mockWreckResolve = { execute: vi.fn() };
  const mockAddSequella = { execute: vi.fn() };
  const mockReplayService = { loadAndReplay: vi.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GameController],
      providers: [
        { provide: GameService, useValue: mockGameService },
        { provide: ScenarioCatalogService, useValue: mockScenarioCatalog },
        { provide: GameResultService, useValue: mockGameResultService },
        { provide: RecordRankingUseCase, useValue: mockRecordRanking },
        { provide: RecordWalletMovementUseCase, useValue: mockRecordWallet },
        { provide: RecordVehicleLostUseCase, useValue: mockRecordVehicleLost },
        { provide: ContactResistanceUseCase, useValue: mockContactResistance },
        { provide: FinalizeGameUseCase, useValue: mockFinalizeGame },
        { provide: GetStandingsUseCase, useValue: mockGetStandings },
        { provide: ChangeEquipmentUseCase, useValue: mockChangeEquipment },
        { provide: WreckResolveUseCase, useValue: mockWreckResolve },
        { provide: AddSequellaUseCase, useValue: mockAddSequella },
        { provide: CampaignReplayService, useValue: mockReplayService },
      ],
    }).compile();

    controller = module.get<GameController>(GameController);
    gameResultService = module.get<GameResultService>(GameResultService);
    vi.clearAllMocks();
  });

  describe('getScenarios()', () => {
    it('retourne la liste du catalogue de scénarios', () => {
      const scenarios = [{ nom: 'X', nom_interne: 'x', type: GameType.ESCARMOUCHE, description: '' }];
      mockScenarioCatalog.getAll.mockReturnValue(scenarios);

      expect(controller.getScenarios()).toEqual(scenarios);
    });
  });

  describe('getGames()', () => {
    it('appelle findAllForCampaign avec l\'id saison et l\'utilisateur', async () => {
      mockGameService.findAllForCampaign.mockResolvedValue([]);

      await controller.getGames(mockRequest as never, 1);

      expect(mockGameService.findAllForCampaign).toHaveBeenCalledWith(1, 42);
    });
  });

  describe('createGame()', () => {
    it('appelle create avec saison, user et DTO', async () => {
      const dto = { scenarioId: 'course_de_la_mort' };
      mockGameService.create.mockResolvedValue({});

      await controller.createGame(mockRequest as never, 1, dto as never);

      expect(mockGameService.create).toHaveBeenCalledWith(1, 42, dto);
    });
  });

  describe('updateGame()', () => {
    it('appelle update avec saison, gameId, user et DTO', async () => {
      const dto = { type: GameType.ESCARMOUCHE };
      mockGameService.update.mockResolvedValue({});

      await controller.updateGame(mockRequest as never, 1, 10, dto as never);

      expect(mockGameService.update).toHaveBeenCalledWith(1, 10, 42, dto);
    });
  });

  describe('removeGame()', () => {
    it('appelle remove avec saison, gameId et user', async () => {
      mockGameService.remove.mockResolvedValue(undefined);

      await controller.removeGame(mockRequest as never, 1, 10);

      expect(mockGameService.remove).toHaveBeenCalledWith(1, 10, 42);
    });
  });

  describe('recordResult()', () => {
    it('appelle gameResultService.recordResult avec les bons paramètres', async () => {
      const mockGame = { id: 1, status: 'JOUE', scenarioName: 'Course de la Mort' };
      gameResultService.recordResult = vi.fn().mockResolvedValue(mockGame);

      const dto = { results: [{ participantId: 1, rank: 1 }] };
      const result = await controller.recordResult(mockRequest as never, 10, 1, dto as never);

      expect(gameResultService.recordResult).toHaveBeenCalledWith(10, 1, 42, dto);
      expect(result).toEqual(mockGame);
    });
  });

  describe('getResults()', () => {
    it('appelle gameResultService.getResults avec les bons paramètres', async () => {
      const mockResults = [{ id: 1, rank: 1, championshipPoints: 10 }];
      gameResultService.getResults = vi.fn().mockResolvedValue(mockResults);

      const result = await controller.getResults(mockRequest as never, 10, 1);

      expect(gameResultService.getResults).toHaveBeenCalledWith(10, 1, 42);
      expect(result).toEqual(mockResults);
    });
  });

  // ── Endpoints campagne (Partie 4) ─────────────────────────────────────────────

  describe('recordRanking()', () => {
    it('passe seasonId, gameId, userId et le dto au use case', async () => {
      mockRecordRanking.execute.mockResolvedValue(undefined);
      const dto = { participantId: 5, rank: 1, championshipPoints: 10 };

      await controller.recordRanking(mockRequest as never, 1, 10, dto);

      expect(mockRecordRanking.execute).toHaveBeenCalledWith({
        seasonId: 1, gameId: 10, userId: 42,
        participantId: 5, rank: 1, championshipPoints: 10,
      });
    });
  });

  describe('recordWallet()', () => {
    it('passe seasonId, gameId, userId et le dto au use case', async () => {
      mockRecordWallet.execute.mockResolvedValue(undefined);
      const dto = { participantId: 5, amount: 3, reason: WalletReason.RECOMPENSE };

      await controller.recordWallet(mockRequest as never, 1, 10, dto);

      expect(mockRecordWallet.execute).toHaveBeenCalledWith({
        seasonId: 1, gameId: 10, userId: 42,
        participantId: 5, amount: 3, reason: WalletReason.RECOMPENSE,
      });
    });
  });

  describe('recordVehicleLost()', () => {
    it('passe les ids véhicule et armes au use case', async () => {
      mockRecordVehicleLost.execute.mockResolvedValue(undefined);
      const dto = { participantId: 5, vehicleId: 1, weaponIds: [7, 8] };

      await controller.recordVehicleLost(mockRequest as never, 1, 10, dto);

      expect(mockRecordVehicleLost.execute).toHaveBeenCalledWith({
        seasonId: 1, gameId: 10, userId: 42,
        participantId: 5, vehicleId: 1, weaponIds: [7, 8],
      });
    });
  });

  describe('contactResistance()', () => {
    it('passe seasonId, gameId et participantId au use case', async () => {
      mockContactResistance.execute.mockResolvedValue(undefined);
      const dto = { participantId: 5 };

      await controller.contactResistance(mockRequest as never, 1, 10, dto);

      expect(mockContactResistance.execute).toHaveBeenCalledWith({
        seasonId: 1, gameId: 10, userId: 42, participantId: 5,
      });
    });
  });

  describe('finalizeGame()', () => {
    it('passe seasonId, gameId et userId au use case', async () => {
      const result = { newAtelierId: 99, newAtelierOrder: 1.5 };
      mockFinalizeGame.execute.mockResolvedValue(result);

      const response = await controller.finalizeGame(mockRequest as never, 1, 10);

      expect(mockFinalizeGame.execute).toHaveBeenCalledWith({ seasonId: 1, gameId: 10, userId: 42 });
      expect(response).toEqual(result);
    });
  });

  describe('getStandings()', () => {
    it('passe seasonId et userId au use case et retourne les entrées', async () => {
      const standings = [{ participantId: 1, userId: 42, teamId: 1, teamName: 'Team A', championshipPoints: 15, wallet: 10 }];
      mockGetStandings.execute.mockResolvedValue(standings);

      const response = await controller.getStandings(mockRequest as never, 1);

      expect(mockGetStandings.execute).toHaveBeenCalledWith({ seasonId: 1, userId: 42 });
      expect(response).toEqual(standings);
    });
  });

  // ── Endpoints campagne (Partie 5) ─────────────────────────────────────────────

  describe('getWorkshop()', () => {
    it('retourne l\'état du participant après replay', async () => {
      const mockSeason = {
        participants: [{
          id: 1, userId: 42, wallet: 30, championshipPoints: 5,
          team: { vehicles: [] },
        }],
      };
      mockReplayService.loadAndReplay.mockResolvedValue(mockSeason);

      const response = await controller.getWorkshop(mockRequest as never, 1);

      expect(mockReplayService.loadAndReplay).toHaveBeenCalledWith(1);
      expect(response.participantId).toBe(1);
      expect(response.wallet).toBe(30);
    });

    it('lève NotFoundException si le participant n\'est pas dans la saison', async () => {
      mockReplayService.loadAndReplay.mockResolvedValue({ participants: [] });
      await expect(controller.getWorkshop(mockRequest as never, 1)).rejects.toThrow('non autorisé');
    });
  });

  describe('changeEquipment()', () => {
    it('passe tous les champs du dto au use case', async () => {
      mockChangeEquipment.execute.mockResolvedValue(undefined);
      const dto = { operation: 'BUY', entityType: 'VEHICLE', nomInterne: 'voiture', targetVehicleId: null, targetEntityId: null, orientation: null };

      await controller.changeEquipment(mockRequest as never, 1, 10, dto as never);

      expect(mockChangeEquipment.execute).toHaveBeenCalledWith({
        seasonId: 1, gameId: 10, userId: 42,
        operation: 'BUY', entityType: 'VEHICLE', nomInterne: 'voiture',
        targetVehicleId: null, targetEntityId: null, orientation: null,
      });
    });
  });

  describe('resolveWreck()', () => {
    it('passe participantId, vehicleId et weaponIdChoice au use case', async () => {
      const outcome = { vehicleId: 1, diceRoll: 3, chocsBefore: 0, wreckResult: 'CHOCS_GAGNE', chocsGained: 0, weaponLostId: null };
      mockWreckResolve.execute.mockResolvedValue({ outcome });
      const dto = { participantId: 5, vehicleId: 1, weaponIdChoice: null };

      const response = await controller.resolveWreck(mockRequest as never, 1, 10, dto);

      expect(mockWreckResolve.execute).toHaveBeenCalledWith({
        seasonId: 1, gameId: 10, userId: 42, participantId: 5, vehicleId: 1, weaponIdChoice: null,
      });
      expect(response).toEqual({ outcome });
    });
  });

  describe('addSequella()', () => {
    it('passe vehicleId et sequellaTypeNom au use case', async () => {
      mockAddSequella.execute.mockResolvedValue(undefined);
      const dto = { vehicleId: 1, sequellaTypeNom: 'moteur_endommage' };

      await controller.addSequella(mockRequest as never, 1, 10, dto);

      expect(mockAddSequella.execute).toHaveBeenCalledWith({
        seasonId: 1, gameId: 10, userId: 42, vehicleId: 1, sequellaTypeNom: 'moteur_endommage',
      });
    });
  });
});
