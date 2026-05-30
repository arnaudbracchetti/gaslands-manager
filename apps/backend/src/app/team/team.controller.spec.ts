/**
 * Tests unitaires pour TeamController.
 *
 * Objectif : vérifier le câblage HTTP — que chaque endpoint appelle
 * la bonne méthode du service avec les bons arguments.
 *
 * On mock TeamService pour tester le controller en isolation totale.
 * On ne teste PAS ici : la logique métier (c'est team.service.spec.ts),
 * ni l'authentification JWT (testée par JwtAuthGuard en intégration).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';
import { Team } from './team.entity';

// Simulacre d'utilisateur connecté (ce que JwtStrategy injecte dans req.user)
const mockUser = { id: 42, email: 'test@test.com' };
const mockRequest = { user: mockUser };

// Équipe fictive retournée par le service mocké
const mockTeam: Partial<Team> = {
  id: 1,
  name: 'Les Furieux du Désert',
  sponsor: 'Rutherford',
  cans: 50,
  userId: 42,
};

describe('TeamController', () => {
  let controller: TeamController;

  const mockTeamService = {
    findByUserId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TeamController],
      providers: [
        { provide: TeamService, useValue: mockTeamService },
      ],
    }).compile();

    controller = module.get<TeamController>(TeamController);
    vi.clearAllMocks();
  });

  // ── GET /teams ──────────────────────────────────────────────────────────────

  describe('getAll()', () => {
    it('appelle TeamService.findByUserId avec l\'id de l\'utilisateur connecté', async () => {
      mockTeamService.findByUserId.mockResolvedValue([mockTeam]);

      const result = await controller.getAll(mockRequest as never);

      // Le controller doit passer req.user.id au service (pas req.user)
      expect(mockTeamService.findByUserId).toHaveBeenCalledWith(42);
      expect(result).toEqual([mockTeam]);
    });
  });

  // ── POST /teams ─────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('appelle TeamService.create avec l\'id user et le DTO', async () => {
      const dto = { name: 'Nouvelle équipe', sponsor: 'Miyazaki', cans: 60 };
      mockTeamService.create.mockResolvedValue({ id: 2, ...dto, userId: 42 });

      const result = await controller.create(mockRequest as never, dto);

      expect(mockTeamService.create).toHaveBeenCalledWith(42, dto);
      expect(result).toMatchObject({ name: 'Nouvelle équipe', userId: 42 });
    });
  });

  // ── PUT /teams/:id ──────────────────────────────────────────────────────────

  describe('update()', () => {
    it('appelle TeamService.update avec id, userId et le DTO', async () => {
      const dto = { name: 'Nom modifié', cans: 75 };
      const updatedTeam = { ...mockTeam, ...dto };
      mockTeamService.update.mockResolvedValue(updatedTeam);

      const result = await controller.update(1, mockRequest as never, dto);

      expect(mockTeamService.update).toHaveBeenCalledWith(1, 42, dto);
      expect(result).toMatchObject({ name: 'Nom modifié' });
    });
  });

  // ── DELETE /teams/:id ───────────────────────────────────────────────────────

  describe('remove()', () => {
    it('appelle TeamService.remove avec id et userId', async () => {
      mockTeamService.remove.mockResolvedValue(undefined);

      await controller.remove(1, mockRequest as never);

      expect(mockTeamService.remove).toHaveBeenCalledWith(1, 42);
    });
  });
});
