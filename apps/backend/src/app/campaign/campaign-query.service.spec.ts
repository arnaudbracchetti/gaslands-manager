import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CampaignQueryService } from './campaign-query.service';
import { CampaignState } from './domain/enums/campaign.enums';

/**
 * Tests du côté lecture (CQRS). Les repositories TypeORM sont mockés — on vérifie
 * la forme des read models, le contrôle d'accès (NotFound, jamais 403) et la
 * dérivation de `/results` depuis le journal `game_events`.
 */
type Repo = { find: ReturnType<typeof vi.fn>; findOne: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> };

function makeRepo(): Repo {
  return { find: vi.fn(), findOne: vi.fn(), count: vi.fn() };
}

describe('CampaignQueryService', () => {
  let campaignRepo: Repo;
  let participantRepo: Repo;
  let gameRepo: Repo;
  let gameEventRepo: Repo;
  let scenarioCatalog: { getByNomInterne: ReturnType<typeof vi.fn>; getAll: ReturnType<typeof vi.fn> };
  let replayService: { load: ReturnType<typeof vi.fn>; loadAndReplay: ReturnType<typeof vi.fn> };
  let service: CampaignQueryService;

  beforeEach(() => {
    campaignRepo = makeRepo();
    participantRepo = makeRepo();
    gameRepo = makeRepo();
    gameEventRepo = makeRepo();
    scenarioCatalog = { getByNomInterne: vi.fn(), getAll: vi.fn() };
    replayService = { load: vi.fn(), loadAndReplay: vi.fn() };
    service = new CampaignQueryService(
      campaignRepo as never,
      participantRepo as never,
      gameRepo as never,
      gameEventRepo as never,
      scenarioCatalog as never,
      replayService as never,
    );
  });

  describe('findByInviteCode', () => {
    it('lève NotFound (message générique) si le code est inconnu', async () => {
      campaignRepo.findOne.mockResolvedValue(null);
      await expect(service.findByInviteCode('xxx')).rejects.toThrow('invalide');
    });

    it('résout le nom de l\'organisateur et le nombre de participants validés', async () => {
      campaignRepo.findOne.mockResolvedValue({ id: 1, name: 'C', state: CampaignState.EN_CONSTRUCTION });
      participantRepo.findOne.mockResolvedValue({ user: { firstName: 'Ada', lastName: 'Lovelace' } });
      participantRepo.count.mockResolvedValue(3);

      const summary = await service.findByInviteCode('code');

      expect(summary).toEqual({
        id: 1, name: 'C', state: CampaignState.EN_CONSTRUCTION,
        organizerName: 'Ada Lovelace', participantCount: 3,
      });
    });
  });

  describe('findOne', () => {
    it('lève NotFound si l\'utilisateur n\'est pas participant VALIDATED', async () => {
      participantRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(1, 42)).rejects.toThrow('introuvable');
    });

    it('retourne le détail enrichi (participantCount + myRole)', async () => {
      participantRepo.findOne.mockResolvedValue({
        isOrganizer: true,
        campaign: { id: 1, name: 'C', state: CampaignState.EN_COURS, inviteCode: 'z' },
      });
      participantRepo.count.mockResolvedValue(4);

      const dto = await service.findOne(1, 42);

      expect(dto.participantCount).toBe(4);
      expect(dto.myRole).toBe('organizer');
      expect(dto.name).toBe('C');
    });
  });

  describe('getResults (dérivé du journal)', () => {
    it('mappe les RankingAssignedEvent en GameResultResponseDto triés par rang', async () => {
      participantRepo.findOne.mockResolvedValue({ id: 99 });  // assertVisibleParticipant OK
      gameRepo.findOne.mockResolvedValue({ id: 7, campaignId: 1 });
      const createdAt = new Date('2026-07-01T00:00:00Z');
      gameEventRepo.find.mockResolvedValue([
        { id: 100, gameId: 7, participantId: 1, rank: 1, championshipPoints: 10, createdAt },
        { id: 101, gameId: 7, participantId: 2, rank: 2, championshipPoints: 5, createdAt },
      ]);

      const results = await service.getResults(1, 7, 42);

      expect(gameEventRepo.find).toHaveBeenCalledWith({
        where: { gameId: 7, eventType: 'RANKING_ASSIGNED' },
        order: { rank: 'ASC' },
      });
      expect(results).toEqual([
        { id: 100, gameId: 7, participantId: 1, rank: 1, championshipPoints: 10, createdAt },
        { id: 101, gameId: 7, participantId: 2, rank: 2, championshipPoints: 5, createdAt },
      ]);
    });

    it('lève NotFound si l\'appelant n\'est pas participant VALIDATED', async () => {
      participantRepo.findOne.mockResolvedValue(null);
      await expect(service.getResults(1, 7, 42)).rejects.toThrow('introuvable');
    });
  });

  describe('getJournal', () => {
    it('enrichit le journal de l\'agrégat avec userName/teamName/createdAt', async () => {
      participantRepo.findOne.mockResolvedValue({ id: 99 });  // assertVisibleParticipant OK
      replayService.load.mockResolvedValue({
        findGame: vi.fn().mockReturnValue({
          journal: vi.fn().mockReturnValue([
            { eventId: 100, participantId: 1, description: 'Classé 1 (+10 PC)' },
          ]),
        }),
      });
      const createdAt = new Date('2026-07-01T00:00:00Z');
      participantRepo.find.mockResolvedValue([
        { id: 1, user: { firstName: 'Ada', lastName: 'Lovelace' }, team: { name: 'Les Furieux' } },
      ]);
      gameEventRepo.find.mockResolvedValue([{ id: 100, createdAt }]);

      const journal = await service.getJournal(1, 7, 42);

      expect(journal).toEqual([
        {
          eventId: 100, participantId: 1, description: 'Classé 1 (+10 PC)',
          userName: 'Ada Lovelace', teamName: 'Les Furieux', createdAt,
        },
      ]);
    });

    it('lève NotFound si l\'appelant n\'est pas participant VALIDATED', async () => {
      participantRepo.findOne.mockResolvedValue(null);
      await expect(service.getJournal(1, 7, 42)).rejects.toThrow('introuvable');
    });
  });

  describe('getParticipantJournal', () => {
    it('regroupe le journal de chaque partie filtré sur le participant ciblé, en résolvant scenarioName', async () => {
      participantRepo.findOne.mockResolvedValueOnce({ id: 99 }); // assertVisibleParticipant OK
      participantRepo.findOne.mockResolvedValueOnce({ id: 1 }); // participant ciblé existe
      const game1 = {
        id: 7,
        order: 1,
        journal: vi.fn().mockReturnValue([
          { eventId: 100, participantId: 1, description: 'Classé 1 (+10 PC)' },
          { eventId: 101, participantId: 2, description: 'Classé 2 (+5 PC)' },
        ]),
      };
      const game2 = {
        id: 8,
        order: 2,
        journal: vi.fn().mockReturnValue([
          { eventId: 102, participantId: 1, description: 'Budget : +4 jerricans (Récompense)' },
        ]),
      };
      replayService.load.mockResolvedValue({
        games: [game1, game2],
        participants: ['p1', 'p2'],
      });
      gameRepo.find.mockResolvedValue([
        { id: 7, scenarioId: 'gate' },
        { id: 8, scenarioId: 'course' },
      ]);
      scenarioCatalog.getByNomInterne.mockImplementation((nomInterne: string) =>
        nomInterne === 'gate' ? { nom: 'La Porte' } : { nom: 'La Course' },
      );
      const createdAt100 = new Date('2026-07-01T00:00:00Z');
      const createdAt102 = new Date('2026-07-02T00:00:00Z');
      gameEventRepo.find.mockResolvedValue([
        { id: 100, createdAt: createdAt100 },
        { id: 102, createdAt: createdAt102 },
      ]);

      const journal = await service.getParticipantJournal(1, 1, 42);

      expect(journal).toEqual([
        { eventId: 100, gameId: 7, gameOrder: 1, scenarioName: 'La Porte', description: 'Classé 1 (+10 PC)', createdAt: createdAt100 },
        { eventId: 102, gameId: 8, gameOrder: 2, scenarioName: 'La Course', description: 'Budget : +4 jerricans (Récompense)', createdAt: createdAt102 },
      ]);
    });

    it('omet les parties sans événement pour ce participant', async () => {
      participantRepo.findOne.mockResolvedValueOnce({ id: 99 });
      participantRepo.findOne.mockResolvedValueOnce({ id: 1 });
      const game1 = {
        id: 7,
        order: 1,
        journal: vi.fn().mockReturnValue([{ eventId: 100, participantId: 2, description: 'Classé 1 (+10 PC)' }]),
      };
      replayService.load.mockResolvedValue({ games: [game1], participants: [] });

      const journal = await service.getParticipantJournal(1, 1, 42);

      expect(journal).toEqual([]);
      expect(gameRepo.find).not.toHaveBeenCalled();
    });

    it('lève NotFound si l\'appelant n\'est pas participant VALIDATED', async () => {
      participantRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.getParticipantJournal(1, 1, 42)).rejects.toThrow('introuvable');
    });

    it('lève NotFound si le participant ciblé n\'appartient pas à la campagne', async () => {
      participantRepo.findOne.mockResolvedValueOnce({ id: 99 });
      participantRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.getParticipantJournal(1, 999, 42)).rejects.toThrow('introuvable');
    });
  });

  describe('findAll', () => {
    it('enrichit chaque participation avec participantCount, myRole et myTeamName', async () => {
      participantRepo.find.mockResolvedValue([
        {
          campaignId: 1, isOrganizer: false, team: { name: 'Les Furieux' },
          campaign: { id: 1, name: 'C', state: CampaignState.EN_CONSTRUCTION, inviteCode: 'z' },
        },
      ]);
      participantRepo.count.mockResolvedValue(2);

      const result = await service.findAll(42);

      expect(result[0].participantCount).toBe(2);
      expect(result[0].myRole).toBe('participant');
      expect(result[0].myTeamName).toBe('Les Furieux');
    });
  });

  describe('findGames', () => {
    it('résout scenarioName via le catalogue', async () => {
      participantRepo.findOne.mockResolvedValue({ id: 1 });  // assertVisibleParticipant OK
      gameRepo.find.mockResolvedValue([{ id: 7, campaignId: 1, scenarioId: 'gate', status: 'PLANIFIE' }]);
      scenarioCatalog.getByNomInterne.mockReturnValue({ nom: 'La Porte' });

      const games = await service.findGames(1, 42);

      expect(games[0].scenarioName).toBe('La Porte');
    });

    it('résout franchissementPortes/gainJerricans via le catalogue', async () => {
      participantRepo.findOne.mockResolvedValue({ id: 1 });
      gameRepo.find.mockResolvedValue([{ id: 7, campaignId: 1, scenarioId: 'course', status: 'PLANIFIE' }]);
      scenarioCatalog.getByNomInterne.mockReturnValue({
        nom: 'La Course', franchissement_portes: true, gain_jerricans: false,
      });

      const games = await service.findGames(1, 42);

      expect(games[0].franchissementPortes).toBe(true);
      expect(games[0].gainJerricans).toBe(false);
    });

    it('retombe sur false quand le scénario est introuvable', async () => {
      participantRepo.findOne.mockResolvedValue({ id: 1 });
      gameRepo.find.mockResolvedValue([{ id: 7, campaignId: 1, scenarioId: null, status: 'PLANIFIE' }]);

      const games = await service.findGames(1, 42);

      expect(games[0].franchissementPortes).toBe(false);
      expect(games[0].gainJerricans).toBe(false);
    });
  });
});
