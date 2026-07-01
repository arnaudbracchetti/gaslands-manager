import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GameResultService } from './game-result.service';
import { GameResultOrm } from './infrastructure/entities/game-result.entity';
import { GameOrm } from './infrastructure/entities/game.entity';
import { CampaignParticipantOrm } from './infrastructure/entities/campaign-participant.entity';
import { CampaignService } from './campaign.service';
import { ScenarioCatalogService } from './scenario-catalog.service';
import { GameStatus, GameType } from './game.enums';
import { ParticipantStatus } from './campaign.enums';

const mockGame = (overrides: Partial<GameOrm> = {}): GameOrm =>
  ({ id: 1, campaignId: 10, type: GameType.EVENEMENT_TELE, status: GameStatus.PLANIFIE, ...overrides } as GameOrm);

const mockParticipant = (id: number, overrides = {}): CampaignParticipantOrm =>
  ({ id, campaignId: 10, status: ParticipantStatus.VALIDATED, ...overrides } as CampaignParticipantOrm);

describe('GameResultService', () => {
  let service: GameResultService;
  let gameRepo: { findOne: ReturnType<typeof vi.fn> };
  let participantRepo: { find: ReturnType<typeof vi.fn> };
  let gameResultRepo: { find: ReturnType<typeof vi.fn> };
  let dataSource: { transaction: ReturnType<typeof vi.fn> };
  let campaignService: { assertOrganizer: ReturnType<typeof vi.fn>; assertVisibleParticipant: ReturnType<typeof vi.fn> };
  let scenarioCatalog: { getByNomInterne: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    gameRepo = { findOne: vi.fn() };
    participantRepo = { find: vi.fn() };
    gameResultRepo = { find: vi.fn() };
    dataSource = {
      transaction: vi.fn().mockImplementation(async (cb: (em: unknown) => Promise<unknown>) => {
        const em = { save: vi.fn().mockResolvedValue([]), getRepository: vi.fn().mockReturnValue({ save: vi.fn() }) };
        return cb(em);
      }),
    };
    campaignService = { assertOrganizer: vi.fn().mockResolvedValue({ id: 10 }), assertVisibleParticipant: vi.fn().mockResolvedValue({ id: 10 }) };
    scenarioCatalog = { getByNomInterne: vi.fn() };

    const module = await Test.createTestingModule({
      providers: [
        GameResultService,
        { provide: getRepositoryToken(GameOrm), useValue: gameRepo },
        { provide: getRepositoryToken(CampaignParticipantOrm), useValue: participantRepo },
        { provide: getRepositoryToken(GameResultOrm), useValue: gameResultRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: CampaignService, useValue: campaignService },
        { provide: ScenarioCatalogService, useValue: scenarioCatalog },
      ],
    }).compile();
    service = module.get(GameResultService);
  });

  describe('recordResult', () => {
    it('crée GameResultOrm avec PC corrects pour EVENEMENT_TELE (4 présents → 2 classés)', async () => {
      gameRepo.findOne.mockResolvedValue(mockGame({ type: GameType.EVENEMENT_TELE }));
      participantRepo.find.mockResolvedValue([mockParticipant(1), mockParticipant(2), mockParticipant(3), mockParticipant(4)]);
      let savedResults: Partial<GameResultOrm>[] = [];
      dataSource.transaction.mockImplementation(async (cb: (em: { save: (entity: unknown, data?: unknown) => Promise<unknown> }) => Promise<unknown>) => {
        const em = { save: vi.fn().mockImplementation((_entity: unknown, data?: unknown) => { if (Array.isArray(data)) savedResults = data as Partial<GameResultOrm>[]; return Promise.resolve(data ?? _entity); }) };
        return cb(em);
      });

      await service.recordResult(10, 1, 99, {
        results: [{ participantId: 1, rank: 1 }, { participantId: 2, rank: 2 }, { participantId: 3, rank: 3 }, { participantId: 4, rank: 4 }],
      });

      expect(savedResults.find(r => r.rank === 1)?.championshipPoints).toBe(10);
      expect(savedResults.find(r => r.rank === 2)?.championshipPoints).toBe(5);
      expect(savedResults.find(r => r.rank === 3)?.championshipPoints).toBe(0);
      expect(savedResults.find(r => r.rank === 4)?.championshipPoints).toBe(0);
    });

    it('PC = 0 pour tous si ESCARMOUCHE', async () => {
      gameRepo.findOne.mockResolvedValue(mockGame({ type: GameType.ESCARMOUCHE }));
      participantRepo.find.mockResolvedValue([mockParticipant(1), mockParticipant(2)]);
      let savedResults: Partial<GameResultOrm>[] = [];
      dataSource.transaction.mockImplementation(async (cb: (em: { save: (entity: unknown, data?: unknown) => Promise<unknown> }) => Promise<unknown>) => {
        const em = { save: vi.fn().mockImplementation((_entity: unknown, data?: unknown) => { if (Array.isArray(data)) savedResults = data as Partial<GameResultOrm>[]; return Promise.resolve(data ?? _entity); }) };
        return cb(em);
      });

      await service.recordResult(10, 1, 99, {
        results: [{ participantId: 1, rank: 1 }, { participantId: 2, rank: 2 }],
      });

      expect(savedResults.every(r => r.championshipPoints === 0)).toBe(true);
    });

    it('⌈N/2⌉ — 5 présents → 3 classés : rangs 1/2/3 reçoivent PC, rangs 4/5 = 0', async () => {
      gameRepo.findOne.mockResolvedValue(mockGame({ type: GameType.EVENEMENT_TELE }));
      participantRepo.find.mockResolvedValue([1, 2, 3, 4, 5].map(i => mockParticipant(i)));
      let savedResults: Partial<GameResultOrm>[] = [];
      dataSource.transaction.mockImplementation(async (cb: (em: { save: (entity: unknown, data?: unknown) => Promise<unknown> }) => Promise<unknown>) => {
        const em = { save: vi.fn().mockImplementation((_entity: unknown, data?: unknown) => { if (Array.isArray(data)) savedResults = data as Partial<GameResultOrm>[]; return Promise.resolve(data ?? _entity); }) };
        return cb(em);
      });

      await service.recordResult(10, 1, 99, {
        results: [1, 2, 3, 4, 5].map((pid, i) => ({ participantId: pid, rank: i + 1 })),
      });

      expect(savedResults.find(r => r.rank === 1)?.championshipPoints).toBe(10);
      expect(savedResults.find(r => r.rank === 2)?.championshipPoints).toBe(5);
      expect(savedResults.find(r => r.rank === 3)?.championshipPoints).toBe(2);
      expect(savedResults.find(r => r.rank === 4)?.championshipPoints).toBe(0);
      expect(savedResults.find(r => r.rank === 5)?.championshipPoints).toBe(0);
    });

    it('400 si partie déjà JOUE', async () => {
      gameRepo.findOne.mockResolvedValue(mockGame({ status: GameStatus.JOUE }));
      participantRepo.find.mockResolvedValue([mockParticipant(1)]);
      await expect(service.recordResult(10, 1, 99, { results: [{ participantId: 1, rank: 1 }] }))
        .rejects.toThrow(BadRequestException);
    });

    it('400 si un participantId est inconnu dans la saison', async () => {
      gameRepo.findOne.mockResolvedValue(mockGame());
      participantRepo.find.mockResolvedValue([mockParticipant(1)]);
      await expect(service.recordResult(10, 1, 99, { results: [{ participantId: 99, rank: 1 }] }))
        .rejects.toThrow(BadRequestException);
    });

    it('400 si rangs non consécutifs (trou)', async () => {
      gameRepo.findOne.mockResolvedValue(mockGame());
      participantRepo.find.mockResolvedValue([mockParticipant(1), mockParticipant(2)]);
      await expect(service.recordResult(10, 1, 99, { results: [{ participantId: 1, rank: 1 }, { participantId: 2, rank: 3 }] }))
        .rejects.toThrow(BadRequestException);
    });

    it('400 si rangs en doublon', async () => {
      gameRepo.findOne.mockResolvedValue(mockGame());
      participantRepo.find.mockResolvedValue([mockParticipant(1), mockParticipant(2)]);
      await expect(service.recordResult(10, 1, 99, { results: [{ participantId: 1, rank: 1 }, { participantId: 2, rank: 1 }] }))
        .rejects.toThrow(BadRequestException);
    });

    it('404 si non-organisateur', async () => {
      campaignService.assertOrganizer.mockRejectedValue(new NotFoundException());
      await expect(service.recordResult(10, 1, 99, { results: [{ participantId: 1, rank: 1 }] }))
        .rejects.toThrow(NotFoundException);
    });

    it('404 si partie introuvable', async () => {
      gameRepo.findOne.mockResolvedValue(null);
      participantRepo.find.mockResolvedValue([mockParticipant(1)]);
      await expect(service.recordResult(10, 999, 99, { results: [{ participantId: 1, rank: 1 }] }))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('getResults', () => {
    it('retourne les résultats de la partie', async () => {
      campaignService.assertVisibleParticipant.mockResolvedValue({ id: 10 });
      gameRepo.findOne.mockResolvedValue(mockGame());
      gameResultRepo.find.mockResolvedValue([
        { id: 1, gameId: 1, participantId: 1, rank: 1, championshipPoints: 10, createdAt: new Date() },
      ]);
      const results = await service.getResults(10, 1, 99);
      expect(results).toHaveLength(1);
      expect(results[0].championshipPoints).toBe(10);
    });
  });
});
