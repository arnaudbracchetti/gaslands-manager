/**
 * Tests unitaires pour UsersController.
 *
 * Objectif : vérifier le câblage HTTP — que chaque endpoint appelle le bon use
 * case avec les bons arguments. Les use cases sont mockés pour tester le
 * controller en isolation totale (mirroir de team.controller.spec.ts).
 *
 * L'autorisation (JwtAuthGuard, RolesGuard) est testée séparément
 * (roles.guard.spec.ts) — pas ici.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { UsersController } from './users.controller';
import { AdminResetPasswordUseCase } from './application/admin-reset-password.usecase';
import { ListUsersUseCase } from './application/list-users.usecase';
import { RemoveUserUseCase } from './application/remove-user.usecase';
import { SetActiveUseCase } from './application/set-active.usecase';
import { UserRole } from './domain/user-role';

// Simulacre d'utilisateur connecté (ce que JwtStrategy injecte dans req.user)
const mockRequest = { user: { id: 1 } };

const mockUserList = [
  {
    id: 1,
    firstName: 'Admin',
    lastName: 'Gaslands',
    pseudo: 'Admin',
    callName: 'Admin',
    email: 'admin@gaslands.local',
    role: UserRole.ADMIN,
    isActive: true,
  },
  {
    id: 2,
    firstName: 'Jean',
    lastName: 'Dupont',
    pseudo: 'JeanLeFou',
    callName: 'JeanLeFou',
    email: 'jean@test.com',
    role: UserRole.USER,
    isActive: true,
  },
];

describe('UsersController', () => {
  let controller: UsersController;

  const mockListUsers = { execute: vi.fn() };
  const mockRemoveUser = { execute: vi.fn() };
  const mockSetActive = { execute: vi.fn() };
  const mockAdminResetPassword = { execute: vi.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: ListUsersUseCase, useValue: mockListUsers },
        { provide: RemoveUserUseCase, useValue: mockRemoveUser },
        { provide: SetActiveUseCase, useValue: mockSetActive },
        { provide: AdminResetPasswordUseCase, useValue: mockAdminResetPassword },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    vi.clearAllMocks();
  });

  // ── GET /users ──────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('appelle ListUsersUseCase et retourne la liste, callName inclus', async () => {
      mockListUsers.execute.mockResolvedValue(mockUserList);

      const result = await controller.findAll();

      expect(mockListUsers.execute).toHaveBeenCalled();
      expect(result).toEqual(mockUserList);
      expect(result[1].callName).toBe('JeanLeFou');
    });
  });

  // ── DELETE /users/:id ───────────────────────────────────────────────────────

  describe('remove()', () => {
    it("appelle RemoveUserUseCase avec la cible et l'id de l'admin connecté", async () => {
      mockRemoveUser.execute.mockResolvedValue(undefined);

      await controller.remove(2, mockRequest as never);

      expect(mockRemoveUser.execute).toHaveBeenCalledWith({ userId: 2, requesterId: 1 });
    });
  });

  // ── PATCH /users/:id/active ─────────────────────────────────────────────────

  describe('setActive()', () => {
    it('appelle SetActiveUseCase avec la cible, le demandeur et isActive', async () => {
      mockSetActive.execute.mockResolvedValue({ ...mockUserList[1], isActive: false });

      const result = await controller.setActive(2, mockRequest as never, { isActive: false });

      expect(mockSetActive.execute).toHaveBeenCalledWith({ userId: 2, requesterId: 1, isActive: false });
      expect(result).toMatchObject({ isActive: false });
    });
  });

  // ── PATCH /users/:id/password ───────────────────────────────────────────────

  describe('resetPassword()', () => {
    it('appelle AdminResetPasswordUseCase avec la cible, le demandeur et le nouveau mot de passe', async () => {
      mockAdminResetPassword.execute.mockResolvedValue(undefined);

      await controller.resetPassword(2, mockRequest as never, { newPassword: 'nouveaumdp' });

      expect(mockAdminResetPassword.execute).toHaveBeenCalledWith({
        userId: 2,
        requesterId: 1,
        newPassword: 'nouveaumdp',
      });
    });
  });
});
