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

const mockRequest = { user: { id: 42, email: 'test@test.com' } };

describe('GameController', () => {
  let controller: GameController;
  let gameResultService: GameResultService;

  const mockGameService = {
    findAllForSeason: vi.fn(),
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GameController],
      providers: [
        { provide: GameService, useValue: mockGameService },
        { provide: ScenarioCatalogService, useValue: mockScenarioCatalog },
        { provide: GameResultService, useValue: mockGameResultService },
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
    it('appelle findAllForSeason avec l\'id saison et l\'utilisateur', async () => {
      mockGameService.findAllForSeason.mockResolvedValue([]);

      await controller.getGames(mockRequest as never, 1);

      expect(mockGameService.findAllForSeason).toHaveBeenCalledWith(1, 42);
    });
  });

  describe('createGame()', () => {
    it('appelle create avec saison, user et DTO', async () => {
      const dto = { scenarioId: 'course_de_la_mort' };
      mockGameService.create.mockResolvedValue({});

      await controller.createGame(mockRequest as never, 1, dto);

      expect(mockGameService.create).toHaveBeenCalledWith(1, 42, dto);
    });
  });

  describe('updateGame()', () => {
    it('appelle update avec saison, gameId, user et DTO', async () => {
      const dto = { type: GameType.ESCARMOUCHE };
      mockGameService.update.mockResolvedValue({});

      await controller.updateGame(mockRequest as never, 1, 10, dto);

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
});
