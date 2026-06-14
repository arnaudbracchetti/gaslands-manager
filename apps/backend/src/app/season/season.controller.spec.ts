/**
 * Tests unitaires pour SeasonController.
 *
 * Vérifie le câblage HTTP — chaque endpoint appelle la bonne méthode du
 * service avec req.user.id (cf. team.controller.spec.ts pour le pattern).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SeasonController } from './season.controller';
import { SeasonService } from './season.service';
import { SeasonState } from './season.enums';
import { SeasonResponseDto } from './dto/season-response.dto';

const mockUser = { id: 42, email: 'test@test.com' };
const mockRequest = { user: mockUser };

const mockSeasonResponse: SeasonResponseDto = {
  id: 1,
  name: 'Coupe Verney',
  state: SeasonState.EN_CONSTRUCTION,
  inviteCode: 'abcdef123456',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  participantCount: 1,
  myRole: 'organizer',
};

describe('SeasonController', () => {
  let controller: SeasonController;

  const mockSeasonService = {
    findAll: vi.fn(),
    create: vi.fn(),
    findByInviteCode: vi.fn(),
    requestJoin: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SeasonController],
      providers: [{ provide: SeasonService, useValue: mockSeasonService }],
    }).compile();

    controller = module.get<SeasonController>(SeasonController);
    vi.clearAllMocks();
  });

  // ── GET /seasons ────────────────────────────────────────────────────────────

  describe('getAll()', () => {
    it('appelle SeasonService.findAll avec l\'id de l\'utilisateur connecté', async () => {
      mockSeasonService.findAll.mockResolvedValue([mockSeasonResponse]);

      const result = await controller.getAll(mockRequest as never);

      expect(mockSeasonService.findAll).toHaveBeenCalledWith(42);
      expect(result).toEqual([mockSeasonResponse]);
    });
  });

  // ── POST /seasons ───────────────────────────────────────────────────────────

  describe('create()', () => {
    it('appelle SeasonService.create avec l\'id user et le DTO', async () => {
      const dto = { name: 'Coupe Verney', teamId: 7 };
      mockSeasonService.create.mockResolvedValue(mockSeasonResponse);

      const result = await controller.create(mockRequest as never, dto);

      expect(mockSeasonService.create).toHaveBeenCalledWith(42, dto);
      expect(result).toEqual(mockSeasonResponse);
    });
  });

  // ── GET /seasons/by-code/:code ──────────────────────────────────────────────

  describe('getByCode()', () => {
    it('appelle SeasonService.findByInviteCode avec le code', async () => {
      const summary = {
        id: 1,
        name: 'Coupe Verney',
        state: SeasonState.EN_CONSTRUCTION,
        organizerName: 'Jean Dupont',
      };
      mockSeasonService.findByInviteCode.mockResolvedValue(summary);

      const result = await controller.getByCode('abcdef123456');

      expect(mockSeasonService.findByInviteCode).toHaveBeenCalledWith('abcdef123456');
      expect(result).toEqual(summary);
    });
  });

  // ── POST /seasons/:id/participants ─────────────────────────────────────────

  describe('requestJoin()', () => {
    it('appelle SeasonService.requestJoin avec l\'id de saison, l\'id user et le DTO', async () => {
      const dto = { teamId: 7 };
      const participant = { id: 2, seasonId: 1, userId: 42, teamId: 7 };
      mockSeasonService.requestJoin.mockResolvedValue(participant);

      const result = await controller.requestJoin(mockRequest as never, 1, dto);

      expect(mockSeasonService.requestJoin).toHaveBeenCalledWith(1, 42, dto);
      expect(result).toEqual(participant);
    });
  });
});
