/**
 * Tests unitaires pour AuthController.
 *
 * On mock les use cases pour ne tester que le câblage HTTP du contrôleur :
 * - les endpoints reçoivent-ils bien les DTOs (userId injecté depuis req.user) ?
 * - retournent-ils la réponse du use case ?
 *
 * Note Vitest : vi.fn() remplace jest.fn().
 */

import { Test, TestingModule } from '@nestjs/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AuthController } from './auth.controller';
import { ChangePasswordUseCase } from './application/change-password.usecase';
import { LoginUseCase } from './application/login.usecase';
import { RegisterUseCase } from './application/register.usecase';
import { UpdateProfileUseCase } from './application/update-profile.usecase';
import { User } from './domain/user';
import { UserRole } from './domain/user-role';

/** Agrégat déposé dans req.user par JwtStrategy - une vraie instance, pas un objet plat. */
const currentUser = new User(
  1,
  'Jean',
  'Dupont',
  'JeanLeFou',
  'jean@test.com',
  'hashed:password123',
  UserRole.USER,
  true,
  new Date(),
  new Date(),
);

const mockAuthResponse = {
  access_token: 'mocked.jwt.token',
  user: {
    id: 1,
    firstName: 'Jean',
    lastName: 'Dupont',
    pseudo: 'JeanLeFou',
    callName: 'JeanLeFou',
    email: 'jean@test.com',
    role: UserRole.USER,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

describe('AuthController', () => {
  let controller: AuthController;

  const mockRegister = { execute: vi.fn() };
  const mockLogin = { execute: vi.fn() };
  const mockUpdateProfile = { execute: vi.fn() };
  const mockChangePassword = { execute: vi.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: RegisterUseCase, useValue: mockRegister },
        { provide: LoginUseCase, useValue: mockLogin },
        { provide: UpdateProfileUseCase, useValue: mockUpdateProfile },
        { provide: ChangePasswordUseCase, useValue: mockChangePassword },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    vi.clearAllMocks();
  });

  // ── register ───────────────────────────────────────────────────────────────

  describe('register()', () => {
    it('appelle RegisterUseCase avec le DTO et l\'IP du demandeur (@Ip(), P0-6), retourne la réponse', async () => {
      const dto = {
        firstName: 'Jean',
        lastName: 'Dupont',
        pseudo: 'JeanLeFou',
        email: 'jean@test.com',
        password: 'password123',
      };
      mockRegister.execute.mockResolvedValue(mockAuthResponse);

      const result = await controller.register('1.2.3.4', dto);

      expect(mockRegister.execute).toHaveBeenCalledWith({ ...dto, remoteIp: '1.2.3.4' });
      expect(result).toEqual(mockAuthResponse);
    });
  });

  // ── login ──────────────────────────────────────────────────────────────────

  describe('login()', () => {
    it('appelle LoginUseCase avec le DTO et retourne la réponse', async () => {
      const dto = { email: 'jean@test.com', password: 'password123' };
      mockLogin.execute.mockResolvedValue(mockAuthResponse);

      const result = await controller.login(dto);

      expect(mockLogin.execute).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockAuthResponse);
    });
  });

  // ── getProfile ─────────────────────────────────────────────────────────────

  describe('getProfile()', () => {
    it("expose callName dans la réponse - le getter de l'agrégat serait sinon perdu par JSON.stringify", () => {
      const result = controller.getProfile({ user: currentUser });

      expect(result.callName).toBe('JeanLeFou');
      expect(result.pseudo).toBe('JeanLeFou');
      expect(result.id).toBe(1);
    });

    it('ne laisse jamais fuiter le hash du mot de passe', () => {
      const result = controller.getProfile({ user: currentUser });

      expect(Object.keys(result)).not.toContain('password');
      expect(Object.keys(result)).not.toContain('passwordHash');
      expect(JSON.stringify(result)).not.toContain('hashed:');
    });
  });

  // ── updateProfile ──────────────────────────────────────────────────────────

  describe('updateProfile()', () => {
    it('appelle UpdateProfileUseCase avec le DTO enrichi de req.user.id', async () => {
      const dto = { firstName: 'Jeanne', lastName: 'Martin', pseudo: 'Furiosa', email: 'jeanne@test.com' };
      const updated = { ...mockAuthResponse.user, ...dto, callName: 'Furiosa' };
      mockUpdateProfile.execute.mockResolvedValue(updated);

      const result = await controller.updateProfile({ user: currentUser }, dto);

      expect(mockUpdateProfile.execute).toHaveBeenCalledWith({ ...dto, userId: 1 });
      expect(result).toEqual(updated);
    });
  });

  // ── changePassword ─────────────────────────────────────────────────────────

  describe('changePassword()', () => {
    it('appelle ChangePasswordUseCase avec le DTO enrichi de req.user.id', async () => {
      const dto = { currentPassword: 'ancienMdp', newPassword: 'nouveauMdp123' };
      mockChangePassword.execute.mockResolvedValue(undefined);

      const result = await controller.changePassword({ user: currentUser }, dto);

      expect(mockChangePassword.execute).toHaveBeenCalledWith({ ...dto, userId: 1 });
      expect(result).toBeUndefined();
    });
  });
});
