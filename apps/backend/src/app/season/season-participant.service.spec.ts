/**
 * Tests unitaires pour SeasonParticipantService.
 *
 * On mock Repository<SeasonParticipant> (cf. season.service.spec.ts pour le
 * pattern de mock de Repository).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SeasonParticipant } from './season-participant.entity';
import { ParticipantStatus, SeasonState } from './season.enums';
import { SeasonParticipantService } from './season-participant.service';
import { TeamService } from '../team/team.service';

const mockSeasonEnConstruction = { id: 1, state: SeasonState.EN_CONSTRUCTION } as never;

const mockOrganizer: SeasonParticipant = {
  id: 1,
  seasonId: 1,
  season: mockSeasonEnConstruction,
  userId: 42,
  user: { firstName: 'Jean', lastName: 'Dupont' } as never,
  teamId: 7,
  team: { name: 'Furies' } as never,
  status: ParticipantStatus.VALIDATED,
  isOrganizer: true,
  isLocked: false,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

const mockPendingParticipant: SeasonParticipant = {
  id: 2,
  seasonId: 1,
  season: mockSeasonEnConstruction,
  userId: 43,
  user: { firstName: 'Alice', lastName: 'Martin' } as never,
  teamId: 8,
  team: { name: 'Scrap Kings' } as never,
  status: ParticipantStatus.PENDING,
  isOrganizer: false,
  isLocked: false,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

describe('SeasonParticipantService', () => {
  let service: SeasonParticipantService;

  const mockParticipantRepo = {
    findOne: vi.fn(),
    find: vi.fn(),
    save: vi.fn(),
    count: vi.fn(),
    delete: vi.fn(),
  };

  const mockTeamService = {
    findOneForUser: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeasonParticipantService,
        { provide: getRepositoryToken(SeasonParticipant), useValue: mockParticipantRepo },
        { provide: TeamService, useValue: mockTeamService },
      ],
    }).compile();

    service = module.get<SeasonParticipantService>(SeasonParticipantService);
    vi.clearAllMocks();
  });

  // ── findParticipants ────────────────────────────────────────────────────────

  describe('findParticipants()', () => {
    it('retourne tous les participants mappés si l\'utilisateur est VALIDATED', async () => {
      mockParticipantRepo.findOne.mockResolvedValue(mockOrganizer);
      mockParticipantRepo.find.mockResolvedValue([mockOrganizer, mockPendingParticipant]);

      const result = await service.findParticipants(1, 42);

      expect(mockParticipantRepo.findOne).toHaveBeenCalledWith({
        where: { seasonId: 1, userId: 42, status: ParticipantStatus.VALIDATED },
      });
      expect(mockParticipantRepo.find).toHaveBeenCalledWith({
        where: { seasonId: 1 },
        relations: { user: true, team: true },
      });
      expect(result).toEqual([
        {
          id: 1,
          userId: 42,
          teamId: 7,
          status: ParticipantStatus.VALIDATED,
          isOrganizer: true,
          userName: 'Jean Dupont',
          teamName: 'Furies',
        },
        {
          id: 2,
          userId: 43,
          teamId: 8,
          status: ParticipantStatus.PENDING,
          isOrganizer: false,
          userName: 'Alice Martin',
          teamName: 'Scrap Kings',
        },
      ]);
    });

    it('lève NotFoundException si l\'utilisateur n\'a pas de participant VALIDATED pour cette saison', async () => {
      mockParticipantRepo.findOne.mockResolvedValue(null);

      await expect(service.findParticipants(1, 99)).rejects.toThrow('Saison introuvable.');
      expect(mockParticipantRepo.find).not.toHaveBeenCalled();
    });
  });

  // ── validate ─────────────────────────────────────────────────────────────────

  describe('validate()', () => {
    it('passe le statut à VALIDATED si accept=true', async () => {
      mockParticipantRepo.findOne
        .mockResolvedValueOnce(mockOrganizer) // vérification organisateur
        .mockResolvedValueOnce({ ...mockPendingParticipant }); // participant cible
      mockParticipantRepo.save.mockImplementation((p) => Promise.resolve(p));

      const result = await service.validate(1, 2, 42, true);

      expect(mockParticipantRepo.findOne).toHaveBeenNthCalledWith(1, {
        where: { seasonId: 1, userId: 42, status: ParticipantStatus.VALIDATED, isOrganizer: true },
      });
      expect(mockParticipantRepo.findOne).toHaveBeenNthCalledWith(2, {
        where: { id: 2, seasonId: 1 },
        relations: { user: true, team: true, season: true },
      });
      expect(mockParticipantRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ParticipantStatus.VALIDATED }),
      );
      expect(result.status).toBe(ParticipantStatus.VALIDATED);
    });

    it('passe le statut à REJECTED si accept=false', async () => {
      mockParticipantRepo.findOne
        .mockResolvedValueOnce(mockOrganizer)
        .mockResolvedValueOnce({ ...mockPendingParticipant });
      mockParticipantRepo.save.mockImplementation((p) => Promise.resolve(p));

      const result = await service.validate(1, 2, 42, false);

      expect(result.status).toBe(ParticipantStatus.REJECTED);
    });

    it('lève NotFoundException si l\'utilisateur n\'est pas organisateur de cette saison', async () => {
      mockParticipantRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.validate(1, 2, 99, true)).rejects.toThrow('Saison introuvable.');
      expect(mockParticipantRepo.save).not.toHaveBeenCalled();
    });

    it('lève NotFoundException si le participant ciblé n\'existe pas dans cette saison', async () => {
      mockParticipantRepo.findOne
        .mockResolvedValueOnce(mockOrganizer)
        .mockResolvedValueOnce(null);

      await expect(service.validate(1, 999, 42, true)).rejects.toThrow('Demande d\'inscription introuvable.');
      expect(mockParticipantRepo.save).not.toHaveBeenCalled();
    });

    it('repasse un participant REJECTED en VALIDATED (revalidation)', async () => {
      const rejected = { ...mockPendingParticipant, status: ParticipantStatus.REJECTED };
      mockParticipantRepo.findOne
        .mockResolvedValueOnce(mockOrganizer)
        .mockResolvedValueOnce(rejected);
      mockParticipantRepo.save.mockImplementation((p) => Promise.resolve(p));

      const result = await service.validate(1, 2, 42, true);

      expect(result.status).toBe(ParticipantStatus.VALIDATED);
    });

    it('refuse un participant VALIDATED non-organisateur si la saison est EN_CONSTRUCTION', async () => {
      const validated = { ...mockPendingParticipant, status: ParticipantStatus.VALIDATED };
      mockParticipantRepo.findOne
        .mockResolvedValueOnce(mockOrganizer)
        .mockResolvedValueOnce(validated);
      mockParticipantRepo.save.mockImplementation((p) => Promise.resolve(p));

      const result = await service.validate(1, 2, 42, false);

      expect(result.status).toBe(ParticipantStatus.REJECTED);
    });

    it('lève BadRequestException si on refuse un participant VALIDATED hors EN_CONSTRUCTION', async () => {
      const seasonEnCours = { id: 1, state: SeasonState.EN_COURS } as never;
      const validated = { ...mockPendingParticipant, status: ParticipantStatus.VALIDATED, season: seasonEnCours };
      mockParticipantRepo.findOne
        .mockResolvedValueOnce(mockOrganizer)
        .mockResolvedValueOnce(validated);

      await expect(service.validate(1, 2, 42, false)).rejects.toThrow(
        'Cette saison n\'accepte plus de modifications de participants.',
      );
      expect(mockParticipantRepo.save).not.toHaveBeenCalled();
    });

    it('lève BadRequestException si on refuse le dernier organisateur VALIDATED', async () => {
      mockParticipantRepo.findOne
        .mockResolvedValueOnce(mockOrganizer) // vérification organisateur
        .mockResolvedValueOnce(mockOrganizer); // participant cible = lui-même
      mockParticipantRepo.count.mockResolvedValue(1);

      await expect(service.validate(1, 1, 42, false)).rejects.toThrow(
        'Impossible de refuser le dernier organisateur de la saison.',
      );
      expect(mockParticipantRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── remove ───────────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('retire un participant VALIDATED non-organisateur (CA1)', async () => {
      mockParticipantRepo.findOne
        .mockResolvedValueOnce(mockOrganizer) // vérification organisateur
        .mockResolvedValueOnce({ ...mockPendingParticipant, status: ParticipantStatus.VALIDATED }); // participant cible
      mockParticipantRepo.delete.mockResolvedValue({ affected: 1 });

      await service.remove(1, 2, 42);

      expect(mockParticipantRepo.findOne).toHaveBeenNthCalledWith(1, {
        where: { seasonId: 1, userId: 42, status: ParticipantStatus.VALIDATED, isOrganizer: true },
      });
      expect(mockParticipantRepo.findOne).toHaveBeenNthCalledWith(2, {
        where: { id: 2, seasonId: 1 },
        relations: { season: true },
      });
      expect(mockParticipantRepo.delete).toHaveBeenCalledWith(2);
    });

    it('retire une demande PENDING (CA2)', async () => {
      mockParticipantRepo.findOne
        .mockResolvedValueOnce(mockOrganizer)
        .mockResolvedValueOnce(mockPendingParticipant);
      mockParticipantRepo.delete.mockResolvedValue({ affected: 1 });

      await service.remove(1, 2, 42);

      expect(mockParticipantRepo.delete).toHaveBeenCalledWith(2);
    });

    it('lève NotFoundException si l\'appelant n\'est pas organisateur validé', async () => {
      mockParticipantRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.remove(1, 2, 99)).rejects.toThrow('Saison introuvable.');
      expect(mockParticipantRepo.delete).not.toHaveBeenCalled();
    });

    it('lève NotFoundException si le participant ciblé n\'existe pas dans cette saison', async () => {
      mockParticipantRepo.findOne
        .mockResolvedValueOnce(mockOrganizer)
        .mockResolvedValueOnce(null);

      await expect(service.remove(1, 999, 42)).rejects.toThrow('Participant introuvable.');
      expect(mockParticipantRepo.delete).not.toHaveBeenCalled();
    });

    it('lève BadRequestException si la saison n\'est plus EN_CONSTRUCTION (CA3)', async () => {
      const seasonEnCours = { id: 1, state: SeasonState.EN_COURS } as never;
      mockParticipantRepo.findOne
        .mockResolvedValueOnce(mockOrganizer)
        .mockResolvedValueOnce({ ...mockPendingParticipant, season: seasonEnCours });

      await expect(service.remove(1, 2, 42)).rejects.toThrow(
        'Cette saison n\'accepte plus de modifications de participants.',
      );
      expect(mockParticipantRepo.delete).not.toHaveBeenCalled();
    });

    it('lève BadRequestException si la cible est le dernier organisateur (CA4)', async () => {
      mockParticipantRepo.findOne
        .mockResolvedValueOnce(mockOrganizer) // vérification organisateur
        .mockResolvedValueOnce(mockOrganizer); // participant cible = lui-même
      mockParticipantRepo.count.mockResolvedValue(1);

      await expect(service.remove(1, 1, 42)).rejects.toThrow(
        'Impossible de retirer le dernier organisateur de la saison.',
      );
      expect(mockParticipantRepo.delete).not.toHaveBeenCalled();
    });

    it('retire un organisateur s\'il en reste au moins un autre (CA5)', async () => {
      mockParticipantRepo.findOne
        .mockResolvedValueOnce(mockOrganizer)
        .mockResolvedValueOnce(mockOrganizer);
      mockParticipantRepo.count.mockResolvedValue(2);
      mockParticipantRepo.delete.mockResolvedValue({ affected: 1 });

      await service.remove(1, 1, 42);

      expect(mockParticipantRepo.delete).toHaveBeenCalledWith(1);
    });
  });

  // ── updateMyTeam ─────────────────────────────────────────────────────────────

  describe('updateMyTeam()', () => {
    it('change l\'équipe engagée si la saison est EN_CONSTRUCTION et l\'équipe appartient à l\'utilisateur', async () => {
      const validated = { ...mockPendingParticipant, status: ParticipantStatus.VALIDATED };
      mockParticipantRepo.findOne
        .mockResolvedValueOnce(validated) // recherche du participant courant
        .mockResolvedValueOnce(null) // assertTeamNotAlreadyEngaged : équipe libre
        .mockResolvedValueOnce({ ...validated, teamId: 99, team: { name: 'Roadkill' } }); // relecture après save
      mockTeamService.findOneForUser.mockResolvedValue({ id: 99, userId: 43 });
      mockParticipantRepo.save.mockImplementation((p) => Promise.resolve(p));

      const result = await service.updateMyTeam(1, 43, 99);

      expect(mockParticipantRepo.findOne).toHaveBeenNthCalledWith(1, {
        where: { seasonId: 1, userId: 43, status: ParticipantStatus.VALIDATED },
        relations: { season: true },
      });
      expect(mockTeamService.findOneForUser).toHaveBeenCalledWith(99, 43);
      expect(mockParticipantRepo.save).toHaveBeenCalledWith(expect.objectContaining({ teamId: 99 }));
      expect(result.teamName).toBe('Roadkill');
    });

    it('lève NotFoundException si l\'utilisateur n\'a pas de participant VALIDATED pour cette saison', async () => {
      mockParticipantRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.updateMyTeam(1, 99, 5)).rejects.toThrow('Saison introuvable.');
      expect(mockParticipantRepo.save).not.toHaveBeenCalled();
    });

    it('lève BadRequestException si la saison n\'est plus EN_CONSTRUCTION', async () => {
      const seasonEnCours = { id: 1, state: SeasonState.EN_COURS } as never;
      const validated = { ...mockPendingParticipant, status: ParticipantStatus.VALIDATED, season: seasonEnCours };
      mockParticipantRepo.findOne.mockResolvedValueOnce(validated);

      await expect(service.updateMyTeam(1, 43, 99)).rejects.toThrow(
        'Cette saison n\'accepte plus de changement d\'équipe.',
      );
      expect(mockParticipantRepo.save).not.toHaveBeenCalled();
    });

    it('lève NotFoundException si l\'équipe choisie n\'appartient pas à l\'utilisateur', async () => {
      const validated = { ...mockPendingParticipant, status: ParticipantStatus.VALIDATED };
      mockParticipantRepo.findOne.mockResolvedValueOnce(validated);
      mockTeamService.findOneForUser.mockRejectedValue(new Error('Équipe #99 introuvable'));

      await expect(service.updateMyTeam(1, 43, 99)).rejects.toThrow('Équipe #99 introuvable');
      expect(mockParticipantRepo.save).not.toHaveBeenCalled();
    });

    it('lève ConflictException si l\'équipe choisie est déjà engagée dans une autre saison', async () => {
      const validated = { ...mockPendingParticipant, status: ParticipantStatus.VALIDATED };
      mockParticipantRepo.findOne
        .mockResolvedValueOnce(validated) // recherche du participant courant
        .mockResolvedValueOnce(mockOrganizer); // assertTeamNotAlreadyEngaged : équipe déjà prise
      mockTeamService.findOneForUser.mockResolvedValue({ id: 99, userId: 43 });

      await expect(service.updateMyTeam(1, 43, 99)).rejects.toThrow(
        'Cette équipe est déjà engagée dans une autre saison.',
      );
      expect(mockParticipantRepo.save).not.toHaveBeenCalled();
    });
  });
});
