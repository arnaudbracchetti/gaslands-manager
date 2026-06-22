/**
 * Tests unitaires pour GameService.
 *
 * Repository Game mocké via getRepositoryToken. SeasonService et
 * ScenarioCatalogService sont mockés (on ne teste pas leur logique ici, seulement
 * que GameService les appelle et réagit à leurs verdicts).
 *
 * Cas couverts :
 * - Création nominale (order = MAX+1, statut PLANIFIE, type du scénario)
 * - NotFound si non-organisateur (délégué à SeasonService.assertOrganizer)
 * - EN_CONSTRUCTION accepté, BadRequest si saison TERMINEE
 * - BadRequest si scénario inconnu
 * - Refus d'édition/suppression d'une partie JOUE
 * - Lecture du programme triée par ordre (tout participant VALIDATED)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { GameService } from './game.service';
import { Game } from './game.entity';
import { GameStatus, GameType } from './game.enums';
import { SeasonService } from '../season/season.service';
import { SeasonState } from '../season/season.enums';
import { ScenarioCatalogService } from './scenario-catalog.service';

const enCoursSeason = { id: 1, state: SeasonState.EN_COURS };
const scenario = {
  nom: 'La Course de la Mort',
  nom_interne: 'course_de_la_mort',
  type: GameType.EVENEMENT_TELE,
  description: '<p>desc</p>',
};

describe('GameService', () => {
  let service: GameService;

  const mockGameRepo = {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    createQueryBuilder: vi.fn(),
  };

  const mockSeasonService = {
    assertOrganizer: vi.fn(),
    assertVisibleParticipant: vi.fn(),
  };

  const mockScenarioCatalog = {
    getByNomInterne: vi.fn(),
    getAll: vi.fn(),
  };

  // Helper : simule la chaîne createQueryBuilder().select().where().getRawOne()
  function stubNextOrder(maxValue: number | null): void {
    const qb = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getRawOne: vi.fn().mockResolvedValue({ max: maxValue }),
    };
    mockGameRepo.createQueryBuilder.mockReturnValue(qb);
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameService,
        { provide: getRepositoryToken(Game), useValue: mockGameRepo },
        { provide: SeasonService, useValue: mockSeasonService },
        { provide: ScenarioCatalogService, useValue: mockScenarioCatalog },
      ],
    }).compile();

    service = module.get<GameService>(GameService);
    vi.clearAllMocks();
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('crée une partie PLANIFIE en fin de programme (order MAX+1) avec le type du scénario', async () => {
      mockSeasonService.assertOrganizer.mockResolvedValue(enCoursSeason);
      mockScenarioCatalog.getByNomInterne.mockReturnValue(scenario);
      stubNextOrder(2); // 2 parties existantes → order 3
      const saved = {
        id: 10,
        seasonId: 1,
        scenarioId: 'course_de_la_mort',
        type: GameType.EVENEMENT_TELE,
        status: GameStatus.PLANIFIE,
        order: 3,
        playedAt: null,
      };
      mockGameRepo.create.mockReturnValue(saved);
      mockGameRepo.save.mockResolvedValue(saved);

      const result = await service.create(1, 42, { scenarioId: 'course_de_la_mort' });

      expect(mockSeasonService.assertOrganizer).toHaveBeenCalledWith(1, 42);
      expect(mockGameRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          seasonId: 1,
          scenarioId: 'course_de_la_mort',
          type: GameType.EVENEMENT_TELE,
          status: GameStatus.PLANIFIE,
          order: 3,
        }),
      );
      expect(result.scenarioName).toBe('La Course de la Mort');
    });

    it('utilise order 1 pour la première partie (MAX null)', async () => {
      mockSeasonService.assertOrganizer.mockResolvedValue(enCoursSeason);
      mockScenarioCatalog.getByNomInterne.mockReturnValue(scenario);
      stubNextOrder(null);
      mockGameRepo.create.mockImplementation((g) => g);
      mockGameRepo.save.mockImplementation((g) => Promise.resolve(g));

      await service.create(1, 42, { scenarioId: 'course_de_la_mort' });

      expect(mockGameRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ order: 1 }),
      );
    });

    it('respecte le type forcé dans le DTO', async () => {
      mockSeasonService.assertOrganizer.mockResolvedValue(enCoursSeason);
      mockScenarioCatalog.getByNomInterne.mockReturnValue(scenario);
      stubNextOrder(0);
      mockGameRepo.create.mockImplementation((g) => g);
      mockGameRepo.save.mockImplementation((g) => Promise.resolve(g));

      await service.create(1, 42, {
        scenarioId: 'course_de_la_mort',
        type: GameType.ESCARMOUCHE,
      });

      expect(mockGameRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: GameType.ESCARMOUCHE }),
      );
    });

    it('propage NotFoundException si non-organisateur', async () => {
      mockSeasonService.assertOrganizer.mockRejectedValue(new NotFoundException());

      await expect(service.create(1, 99, { scenarioId: 'x' })).rejects.toThrow(NotFoundException);
      expect(mockGameRepo.save).not.toHaveBeenCalled();
    });

    it('accepte la création quand la saison est EN_CONSTRUCTION', async () => {
      mockSeasonService.assertOrganizer.mockResolvedValue({ id: 1, state: SeasonState.EN_CONSTRUCTION });
      mockScenarioCatalog.getByNomInterne.mockReturnValue(scenario);
      stubNextOrder(0);
      mockGameRepo.create.mockImplementation((g) => g);
      mockGameRepo.save.mockImplementation((g) => Promise.resolve(g));

      await service.create(1, 42, { scenarioId: 'course_de_la_mort' });

      expect(mockGameRepo.save).toHaveBeenCalled();
    });

    it('lève BadRequestException si la saison est TERMINEE', async () => {
      mockSeasonService.assertOrganizer.mockResolvedValue({ id: 1, state: SeasonState.TERMINEE });

      await expect(service.create(1, 42, { scenarioId: 'course_de_la_mort' })).rejects.toThrow(
        BadRequestException,
      );
      expect(mockGameRepo.save).not.toHaveBeenCalled();
    });

    it('lève BadRequestException si le scénario est inconnu', async () => {
      mockSeasonService.assertOrganizer.mockResolvedValue(enCoursSeason);
      mockScenarioCatalog.getByNomInterne.mockReturnValue(undefined);

      await expect(service.create(1, 42, { scenarioId: 'inexistant' })).rejects.toThrow(
        BadRequestException,
      );
      expect(mockGameRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── update ──────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('modifie le scénario d\'une partie PLANIFIE', async () => {
      mockSeasonService.assertOrganizer.mockResolvedValue(enCoursSeason);
      const game = { id: 10, seasonId: 1, status: GameStatus.PLANIFIE, scenarioId: 'old', type: GameType.EVENEMENT_TELE };
      mockGameRepo.findOne.mockResolvedValue(game);
      mockScenarioCatalog.getByNomInterne.mockReturnValue(scenario);
      mockGameRepo.save.mockImplementation((g) => Promise.resolve(g));

      const result = await service.update(1, 10, 42, { scenarioId: 'course_de_la_mort' });

      expect(result.scenarioId).toBe('course_de_la_mort');
    });

    it('refuse de modifier une partie JOUE', async () => {
      mockSeasonService.assertOrganizer.mockResolvedValue(enCoursSeason);
      mockGameRepo.findOne.mockResolvedValue({ id: 10, seasonId: 1, status: GameStatus.JOUE });

      await expect(service.update(1, 10, 42, { type: GameType.ESCARMOUCHE })).rejects.toThrow(
        BadRequestException,
      );
      expect(mockGameRepo.save).not.toHaveBeenCalled();
    });

    it('lève NotFoundException si la partie n\'existe pas', async () => {
      mockSeasonService.assertOrganizer.mockResolvedValue(enCoursSeason);
      mockGameRepo.findOne.mockResolvedValue(null);

      await expect(service.update(1, 999, 42, {})).rejects.toThrow(NotFoundException);
    });
  });

  // ── remove ──────────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('supprime une partie PLANIFIE', async () => {
      mockSeasonService.assertOrganizer.mockResolvedValue(enCoursSeason);
      mockGameRepo.findOne.mockResolvedValue({ id: 10, seasonId: 1, status: GameStatus.PLANIFIE });
      mockGameRepo.delete.mockResolvedValue({ affected: 1 });

      await service.remove(1, 10, 42);

      expect(mockGameRepo.delete).toHaveBeenCalledWith(10);
    });

    it('refuse de supprimer une partie JOUE', async () => {
      mockSeasonService.assertOrganizer.mockResolvedValue(enCoursSeason);
      mockGameRepo.findOne.mockResolvedValue({ id: 10, seasonId: 1, status: GameStatus.JOUE });

      await expect(service.remove(1, 10, 42)).rejects.toThrow(BadRequestException);
      expect(mockGameRepo.delete).not.toHaveBeenCalled();
    });
  });

  // ── findAllForSeason ──────────────────────────────────────────────────────────

  describe('findAllForSeason()', () => {
    it('retourne le programme trié par ordre, enrichi du libellé de scénario', async () => {
      mockSeasonService.assertVisibleParticipant.mockResolvedValue(enCoursSeason);
      mockGameRepo.find.mockResolvedValue([
        { id: 1, seasonId: 1, scenarioId: 'course_de_la_mort', order: 1, status: GameStatus.PLANIFIE },
      ]);
      mockScenarioCatalog.getByNomInterne.mockReturnValue(scenario);

      const result = await service.findAllForSeason(1, 7);

      expect(mockSeasonService.assertVisibleParticipant).toHaveBeenCalledWith(1, 7);
      expect(mockGameRepo.find).toHaveBeenCalledWith({
        where: { seasonId: 1 },
        order: { order: 'ASC' },
      });
      expect(result[0].scenarioName).toBe('La Course de la Mort');
    });

    it('propage NotFoundException si l\'utilisateur n\'est pas participant VALIDATED', async () => {
      mockSeasonService.assertVisibleParticipant.mockRejectedValue(new NotFoundException());

      await expect(service.findAllForSeason(1, 99)).rejects.toThrow(NotFoundException);
    });
  });
});
