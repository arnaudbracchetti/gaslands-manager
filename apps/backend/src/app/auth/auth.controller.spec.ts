/**
 * Tests unitaires pour AuthController.
 *
 * On mock AuthService pour tester uniquement le câblage HTTP du contrôleur :
 * - Les endpoints reçoivent-ils bien les DTOs ?
 * - Retournent-ils la réponse du service ?
 *
 * Note Vitest : vi.fn() remplace jest.fn().
 */

import { Test, TestingModule } from '@nestjs/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

const mockAuthResponse = {
  access_token: 'mocked.jwt.token',
  user: {
    id: 1,
    firstName: 'Jean',
    lastName: 'Dupont',
    email: 'jean@test.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    register: vi.fn().mockResolvedValue(mockAuthResponse),
    login: vi.fn().mockResolvedValue(mockAuthResponse),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    vi.clearAllMocks();
  });

  // ── register ───────────────────────────────────────────────────────────────

  describe('register()', () => {
    it('appelle AuthService.register() avec le DTO et retourne la réponse', async () => {
      const dto = { firstName: 'Jean', lastName: 'Dupont', email: 'jean@test.com', password: 'password123' };
      mockAuthService.register.mockResolvedValue(mockAuthResponse);

      const result = await controller.register(dto);

      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockAuthResponse);
    });
  });

  // ── login ──────────────────────────────────────────────────────────────────

  describe('login()', () => {
    it('appelle AuthService.login() avec le DTO et retourne la réponse', async () => {
      const dto = { email: 'jean@test.com', password: 'password123' };
      mockAuthService.login.mockResolvedValue(mockAuthResponse);

      const result = await controller.login(dto);

      expect(mockAuthService.login).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockAuthResponse);
    });
  });

  // ── getProfile ─────────────────────────────────────────────────────────────

  describe('getProfile()', () => {
    it('retourne req.user (profil injecté par JwtAuthGuard)', () => {
      const req = { user: mockAuthResponse.user };

      const result = controller.getProfile(req);

      expect(result).toEqual(mockAuthResponse.user);
    });
  });
});
