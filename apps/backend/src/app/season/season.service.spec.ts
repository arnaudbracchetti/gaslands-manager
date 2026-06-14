/**
 * Tests unitaires pour SeasonService.
 *
 * On mock Repository<Season>, Repository<SeasonParticipant> et TeamService
 * (cf. team.service.spec.ts pour le pattern de mock de Repository).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Season } from './season.entity';
import { SeasonParticipant } from './season-participant.entity';
import { SeasonState, ParticipantStatus } from './season.enums';
import { SeasonService } from './season.service';
import { TeamService } from '../team/team.service';
import { CreateSeasonDto } from './dto/create-season.dto';

const mockSeason: Season = {
  id: 1,
  name: 'Coupe Verney',
  state: SeasonState.EN_CONSTRUCTION,
  inviteCode: 'abcdef123456',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

const mockParticipant: SeasonParticipant = {
  id: 1,
  seasonId: 1,
  season: mockSeason,
  userId: 42,
  user: null as never,
  teamId: 7,
  team: null as never,
  status: ParticipantStatus.VALIDATED,
  isOrganizer: true,
  isLocked: false,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

describe('SeasonService', () => {
  let service: SeasonService;

  const mockSeasonRepo = {
    create: vi.fn(),
    save: vi.fn(),
    findOne: vi.fn(),
  };

  const mockParticipantRepo = {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    count: vi.fn(),
  };

  const mockTeamService = {
    findOneForUser: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeasonService,
        { provide: getRepositoryToken(Season), useValue: mockSeasonRepo },
        { provide: getRepositoryToken(SeasonParticipant), useValue: mockParticipantRepo },
        { provide: TeamService, useValue: mockTeamService },
      ],
    }).compile();

    service = module.get<SeasonService>(SeasonService);
    vi.clearAllMocks();
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('vérifie que l\'équipe appartient à l\'utilisateur, crée la saison et le participant organisateur', async () => {
      const dto: CreateSeasonDto = { name: 'Coupe Verney', teamId: 7 };

      mockTeamService.findOneForUser.mockResolvedValue({ id: 7, userId: 42 });
      mockSeasonRepo.create.mockReturnValue({
        name: dto.name,
        state: SeasonState.EN_CONSTRUCTION,
        inviteCode: expect.any(String),
      });
      mockSeasonRepo.save.mockResolvedValue(mockSeason);
      mockParticipantRepo.create.mockReturnValue(mockParticipant);
      mockParticipantRepo.save.mockResolvedValue(mockParticipant);

      const result = await service.create(42, dto);

      // L'équipe doit être vérifiée AVANT toute création
      expect(mockTeamService.findOneForUser).toHaveBeenCalledWith(7, 42);

      // La saison est créée avec EN_CONSTRUCTION et un inviteCode généré (non vide)
      expect(mockSeasonRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Coupe Verney',
          state: SeasonState.EN_CONSTRUCTION,
          inviteCode: expect.any(String),
        }),
      );
      const createdSeasonArg = mockSeasonRepo.create.mock.calls[0][0];
      expect(createdSeasonArg.inviteCode).not.toBe('');

      // Le participant créé doit être organisateur, validé, et lié à l'équipe choisie
      expect(mockParticipantRepo.create).toHaveBeenCalledWith({
        seasonId: mockSeason.id,
        userId: 42,
        teamId: 7,
        status: ParticipantStatus.VALIDATED,
        isOrganizer: true,
      });

      expect(result).toEqual({ ...mockSeason, participantCount: 1, myRole: 'organizer' });
    });

    it('propage l\'erreur si l\'équipe n\'appartient pas à l\'utilisateur (sans créer de saison)', async () => {
      const dto: CreateSeasonDto = { name: 'Coupe Verney', teamId: 999 };
      mockTeamService.findOneForUser.mockRejectedValue(new Error('Équipe introuvable'));

      await expect(service.create(42, dto)).rejects.toThrow('Équipe introuvable');

      expect(mockSeasonRepo.create).not.toHaveBeenCalled();
      expect(mockParticipantRepo.create).not.toHaveBeenCalled();
    });
  });

  // ── findAll ──────────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('retourne les saisons de l\'utilisateur enrichies avec participantCount et myRole', async () => {
      mockParticipantRepo.find.mockResolvedValue([mockParticipant]);
      mockParticipantRepo.count.mockResolvedValue(3);

      const result = await service.findAll(42);

      expect(mockParticipantRepo.find).toHaveBeenCalledWith({
        where: { userId: 42 },
        relations: { season: true },
      });
      expect(mockParticipantRepo.count).toHaveBeenCalledWith({ where: { seasonId: mockSeason.id } });
      expect(result).toEqual([{ ...mockSeason, participantCount: 3, myRole: 'organizer' }]);
    });

    it('retourne myRole: "participant" si l\'utilisateur n\'est pas organisateur', async () => {
      const nonOrganizer = { ...mockParticipant, isOrganizer: false };
      mockParticipantRepo.find.mockResolvedValue([nonOrganizer]);
      mockParticipantRepo.count.mockResolvedValue(1);

      const result = await service.findAll(42);

      expect(result[0].myRole).toBe('participant');
    });

    it('retourne un tableau vide si l\'utilisateur n\'a aucune participation', async () => {
      mockParticipantRepo.find.mockResolvedValue([]);

      const result = await service.findAll(99);

      expect(result).toEqual([]);
      expect(mockParticipantRepo.count).not.toHaveBeenCalled();
    });
  });

  // ── findByInviteCode ────────────────────────────────────────────────────────

  describe('findByInviteCode()', () => {
    it('retourne les infos minimales de la saison et le nom de l\'organisateur', async () => {
      mockSeasonRepo.findOne.mockResolvedValue(mockSeason);
      mockParticipantRepo.findOne.mockResolvedValue({
        ...mockParticipant,
        user: { firstName: 'Jean', lastName: 'Dupont' },
      });

      const result = await service.findByInviteCode('abcdef123456');

      expect(mockSeasonRepo.findOne).toHaveBeenCalledWith({ where: { inviteCode: 'abcdef123456' } });
      expect(mockParticipantRepo.findOne).toHaveBeenCalledWith({
        where: { seasonId: mockSeason.id, isOrganizer: true },
        relations: { user: true },
      });
      expect(result).toEqual({
        id: mockSeason.id,
        name: mockSeason.name,
        state: mockSeason.state,
        organizerName: 'Jean Dupont',
      });
    });

    it('lève NotFoundException si le code est invalide', async () => {
      mockSeasonRepo.findOne.mockResolvedValue(null);

      await expect(service.findByInviteCode('inconnu')).rejects.toThrow('Code d\'invitation invalide.');
      expect(mockParticipantRepo.findOne).not.toHaveBeenCalled();
    });
  });

  // ── findOne ──────────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('retourne la saison enrichie si l\'utilisateur a un participant VALIDATED', async () => {
      mockParticipantRepo.findOne.mockResolvedValue(mockParticipant);
      mockParticipantRepo.count.mockResolvedValue(3);

      const result = await service.findOne(mockSeason.id, 42);

      expect(mockParticipantRepo.findOne).toHaveBeenCalledWith({
        where: { seasonId: mockSeason.id, userId: 42, status: ParticipantStatus.VALIDATED },
        relations: { season: true },
      });
      expect(result).toEqual({ ...mockSeason, participantCount: 3, myRole: 'organizer' });
    });

    it('retourne myRole: "participant" si l\'utilisateur n\'est pas organisateur', async () => {
      mockParticipantRepo.findOne.mockResolvedValue({ ...mockParticipant, isOrganizer: false });
      mockParticipantRepo.count.mockResolvedValue(2);

      const result = await service.findOne(mockSeason.id, 42);

      expect(result.myRole).toBe('participant');
    });

    it('lève NotFoundException si l\'utilisateur n\'a pas de participant VALIDATED pour cette saison', async () => {
      mockParticipantRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(mockSeason.id, 99)).rejects.toThrow('Saison introuvable.');
      expect(mockParticipantRepo.count).not.toHaveBeenCalled();
    });
  });

  // ── requestJoin ──────────────────────────────────────────────────────────────

  describe('requestJoin()', () => {
    const dto = { teamId: 7 };

    it('crée un SeasonParticipant PENDING si tout est valide', async () => {
      mockTeamService.findOneForUser.mockResolvedValue({ id: 7, userId: 42 });
      mockSeasonRepo.findOne.mockResolvedValue(mockSeason);
      mockParticipantRepo.findOne.mockResolvedValue(null);
      const created = {
        seasonId: mockSeason.id,
        userId: 42,
        teamId: 7,
        status: ParticipantStatus.PENDING,
        isOrganizer: false,
      };
      mockParticipantRepo.create.mockReturnValue(created);
      mockParticipantRepo.save.mockResolvedValue({ id: 5, ...created });

      const result = await service.requestJoin(mockSeason.id, 42, dto);

      expect(mockTeamService.findOneForUser).toHaveBeenCalledWith(7, 42);
      expect(mockParticipantRepo.create).toHaveBeenCalledWith(created);
      expect(result).toEqual({ id: 5, ...created });
    });

    it('lève NotFoundException si la saison est introuvable', async () => {
      mockTeamService.findOneForUser.mockResolvedValue({ id: 7, userId: 42 });
      mockSeasonRepo.findOne.mockResolvedValue(null);

      await expect(service.requestJoin(999, 42, dto)).rejects.toThrow('Saison introuvable.');
      expect(mockParticipantRepo.create).not.toHaveBeenCalled();
    });

    it('rejette si la saison n\'est plus EN_CONSTRUCTION', async () => {
      mockTeamService.findOneForUser.mockResolvedValue({ id: 7, userId: 42 });
      mockSeasonRepo.findOne.mockResolvedValue({ ...mockSeason, state: SeasonState.EN_COURS });

      await expect(service.requestJoin(mockSeason.id, 42, dto)).rejects.toThrow(
        'Cette saison n\'accepte plus de nouvelles inscriptions.',
      );
      expect(mockParticipantRepo.create).not.toHaveBeenCalled();
    });

    it('rejette si l\'utilisateur a déjà une demande pour cette saison', async () => {
      mockTeamService.findOneForUser.mockResolvedValue({ id: 7, userId: 42 });
      mockSeasonRepo.findOne.mockResolvedValue(mockSeason);
      mockParticipantRepo.findOne.mockResolvedValue(mockParticipant);

      await expect(service.requestJoin(mockSeason.id, 42, dto)).rejects.toThrow(
        'Vous avez déjà une demande d\'inscription pour cette saison.',
      );
      expect(mockParticipantRepo.create).not.toHaveBeenCalled();
    });

    it('propage l\'erreur si l\'équipe n\'appartient pas à l\'utilisateur', async () => {
      mockTeamService.findOneForUser.mockRejectedValue(new Error('Équipe introuvable'));

      await expect(service.requestJoin(mockSeason.id, 42, dto)).rejects.toThrow('Équipe introuvable');
      expect(mockSeasonRepo.findOne).not.toHaveBeenCalled();
      expect(mockParticipantRepo.create).not.toHaveBeenCalled();
    });
  });
});
