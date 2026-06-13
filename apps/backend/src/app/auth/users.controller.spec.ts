/**
 * Tests unitaires pour UsersController.
 *
 * Objectif : vérifier le câblage HTTP — que chaque endpoint appelle la bonne
 * méthode du service avec les bons arguments. On mock UserService pour tester
 * le controller en isolation totale (mirroir de team.controller.spec.ts).
 *
 * L'autorisation (JwtAuthGuard, RolesGuard) est testée séparément
 * (roles.guard.spec.ts) — pas ici.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { UsersController } from './users.controller';
import { UserService } from './user.service';
import { UserRole } from './user.entity';

// Simulacre d'utilisateur connecté (ce que JwtStrategy injecte dans req.user)
const mockAdmin = { id: 1, email: 'admin@gaslands.local', role: UserRole.ADMIN };
const mockRequest = { user: mockAdmin };

const mockUserList = [
  { id: 1, firstName: 'Admin', lastName: 'Gaslands', email: 'admin@gaslands.local', role: UserRole.ADMIN, isActive: true },
  { id: 2, firstName: 'Jean', lastName: 'Dupont', email: 'jean@test.com', role: UserRole.USER, isActive: true },
];

describe('UsersController', () => {
  let controller: UsersController;

  const mockUserService = {
    findAll: vi.fn(),
    remove: vi.fn(),
    setActive: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UserService, useValue: mockUserService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    vi.clearAllMocks();
  });

  // ── GET /users ──────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('appelle UserService.findAll et retourne la liste', async () => {
      mockUserService.findAll.mockResolvedValue(mockUserList);

      const result = await controller.findAll();

      expect(mockUserService.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockUserList);
    });
  });

  // ── DELETE /users/:id ───────────────────────────────────────────────────────

  describe('remove()', () => {
    it('appelle UserService.remove avec id et l\'id de l\'admin connecté', async () => {
      mockUserService.remove.mockResolvedValue(undefined);

      await controller.remove(2, mockRequest as never);

      expect(mockUserService.remove).toHaveBeenCalledWith(2, 1);
    });
  });

  // ── PATCH /users/:id/active ─────────────────────────────────────────────────

  describe('setActive()', () => {
    it('appelle UserService.setActive avec id, requesterId et isActive', async () => {
      mockUserService.setActive.mockResolvedValue({ ...mockUserList[1], isActive: false });

      const result = await controller.setActive(2, mockRequest as never, { isActive: false });

      expect(mockUserService.setActive).toHaveBeenCalledWith(2, 1, false);
      expect(result).toMatchObject({ isActive: false });
    });
  });
});
