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
import { SeasonParticipantService } from './season-participant.service';
import { SeasonState, ParticipantStatus } from './season.enums';
import { SeasonResponseDto } from './dto/season-response.dto';
import { SeasonParticipantResponseDto } from './dto/season-participant-response.dto';

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
    findOne: vi.fn(),
    remove: vi.fn(),
    findPendingForUser: vi.fn(),
    findOrganizedWithPendingRequests: vi.fn(),
  };

  const mockSeasonParticipantService = {
    findParticipants: vi.fn(),
    validate: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SeasonController],
      providers: [
        { provide: SeasonService, useValue: mockSeasonService },
        { provide: SeasonParticipantService, useValue: mockSeasonParticipantService },
      ],
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

  // ── GET /seasons/:id/participants ──────────────────────────────────────────

  describe('getParticipants()', () => {
    it('appelle SeasonParticipantService.findParticipants avec l\'id de saison et l\'id user', async () => {
      const participants: SeasonParticipantResponseDto[] = [
        {
          id: 1,
          userId: 42,
          teamId: 7,
          status: ParticipantStatus.VALIDATED,
          isOrganizer: true,
          userName: 'Jean Dupont',
          teamName: 'Furies',
        },
      ];
      mockSeasonParticipantService.findParticipants.mockResolvedValue(participants);

      const result = await controller.getParticipants(mockRequest as never, 1);

      expect(mockSeasonParticipantService.findParticipants).toHaveBeenCalledWith(1, 42);
      expect(result).toEqual(participants);
    });
  });

  // ── PUT /seasons/:id/participants/:pid/validate ────────────────────────────

  describe('validateParticipant()', () => {
    it('appelle SeasonParticipantService.validate avec saison, participant, user et accept', async () => {
      const dto = { accept: true };
      const participant: SeasonParticipantResponseDto = {
        id: 2,
        userId: 43,
        teamId: 8,
        status: ParticipantStatus.VALIDATED,
        isOrganizer: false,
        userName: 'Alice Martin',
        teamName: 'Scrap Kings',
      };
      mockSeasonParticipantService.validate.mockResolvedValue(participant);

      const result = await controller.validateParticipant(mockRequest as never, 1, 2, dto);

      expect(mockSeasonParticipantService.validate).toHaveBeenCalledWith(1, 2, 42, true);
      expect(result).toEqual(participant);
    });
  });

  // ── GET /seasons/pending ────────────────────────────────────────────────────

  describe('getPending()', () => {
    it('appelle SeasonService.findPendingForUser avec l\'id de l\'utilisateur connecté', async () => {
      const pending = { ...mockSeasonResponse, myRole: 'participant' as const };
      mockSeasonService.findPendingForUser.mockResolvedValue([pending]);

      const result = await controller.getPending(mockRequest as never);

      expect(mockSeasonService.findPendingForUser).toHaveBeenCalledWith(42);
      expect(result).toEqual([pending]);
    });
  });

  // ── GET /seasons/organizing/pending-requests ───────────────────────────────

  describe('getOrganizingPendingRequests()', () => {
    it('appelle SeasonService.findOrganizedWithPendingRequests avec l\'id de l\'utilisateur connecté', async () => {
      const organized = { ...mockSeasonResponse, pendingRequestsCount: 2 };
      mockSeasonService.findOrganizedWithPendingRequests.mockResolvedValue([organized]);

      const result = await controller.getOrganizingPendingRequests(mockRequest as never);

      expect(mockSeasonService.findOrganizedWithPendingRequests).toHaveBeenCalledWith(42);
      expect(result).toEqual([organized]);
    });
  });

  // ── GET /seasons/:id ────────────────────────────────────────────────────────

  describe('getOne()', () => {
    it('appelle SeasonService.findOne avec l\'id de saison et l\'id user', async () => {
      mockSeasonService.findOne.mockResolvedValue(mockSeasonResponse);

      const result = await controller.getOne(mockRequest as never, 1);

      expect(mockSeasonService.findOne).toHaveBeenCalledWith(1, 42);
      expect(result).toEqual(mockSeasonResponse);
    });
  });

  // ── DELETE /seasons/:id ─────────────────────────────────────────────────────

  describe('remove()', () => {
    it('appelle SeasonService.remove avec l\'id de saison et l\'id user', async () => {
      mockSeasonService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(mockRequest as never, 1);

      expect(mockSeasonService.remove).toHaveBeenCalledWith(1, 42);
      expect(result).toBeUndefined();
    });
  });
});
