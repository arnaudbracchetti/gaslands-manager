/**
 * Tests unitaires pour AuthService.
 *
 * Note ESM + Vitest :
 * vi.mock('bcrypt') est nécessaire pour mocker un module ESM.
 * Vitest hisse automatiquement vi.mock() en haut du fichier
 * pour que le mock soit actif avant que le module soit importé.
 */

import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('bcrypt');

import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UserRole } from './user.entity';
import { UserService } from './user.service';

const mockUserWithPassword = {
  id: 1,
  firstName: 'Jean',
  lastName: 'Dupont',
  email: 'jean@test.com',
  password: '$2b$10$hashedpassword',
  role: UserRole.USER,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockSafeUser = {
  id: 1,
  firstName: 'Jean',
  lastName: 'Dupont',
  email: 'jean@test.com',
  role: UserRole.USER,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AuthService', () => {
  let service: AuthService;

  const mockUserService = {
    findByEmail: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
  };

  const mockJwtService = {
    sign: vi.fn().mockReturnValue('mocked.jwt.token'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: mockUserService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    vi.clearAllMocks();
    // Réinitialise mockJwtService.sign après clearAllMocks
    mockJwtService.sign.mockReturnValue('mocked.jwt.token');
  });

  // ── register ───────────────────────────────────────────────────────────────

  describe('register()', () => {
    const dto = { firstName: 'Jean', lastName: 'Dupont', email: 'jean@test.com', password: 'password123' };

    it('crée l\'utilisateur, signe un JWT et retourne access_token + user', async () => {
      mockUserService.create.mockResolvedValue(mockSafeUser);

      const result = await service.register(dto);

      expect(mockUserService.create).toHaveBeenCalledWith(dto);
      expect(mockJwtService.sign).toHaveBeenCalledWith({ sub: 1, email: 'jean@test.com', role: UserRole.USER });
      expect(result).toEqual({ access_token: 'mocked.jwt.token', user: mockSafeUser });
    });

    it('propage ConflictException si l\'email est déjà pris', async () => {
      mockUserService.create.mockRejectedValue(new ConflictException('Cet email est déjà utilisé'));

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });

    it('lève UnauthorizedException si des champs sont manquants', async () => {
      const incompleteDto = { firstName: '', lastName: 'Dupont', email: 'jean@test.com', password: 'abc' };

      await expect(service.register(incompleteDto)).rejects.toThrow(UnauthorizedException);
    });

    it('lève UnauthorizedException si le mot de passe est trop court', async () => {
      await expect(service.register({ ...dto, password: 'abc' })).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── login ──────────────────────────────────────────────────────────────────

  describe('login()', () => {
    const dto = { email: 'jean@test.com', password: 'password123' };

    it('retourne access_token + user si les identifiants sont corrects', async () => {
      mockUserService.findByEmail.mockResolvedValue(mockUserWithPassword);
      // vi.mocked() informe TypeScript que bcrypt.compare est un vi.fn()
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await service.login(dto);

      expect(result.access_token).toBe('mocked.jwt.token');
      expect(result.user).not.toHaveProperty('password');
    });

    it('lève UnauthorizedException si l\'email est inconnu', async () => {
      mockUserService.findByEmail.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(dto)).rejects.toThrow('Identifiants invalides');
    });

    it('lève UnauthorizedException si le mot de passe est incorrect', async () => {
      mockUserService.findByEmail.mockResolvedValue(mockUserWithPassword);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(dto)).rejects.toThrow('Identifiants invalides');
    });
  });
});
