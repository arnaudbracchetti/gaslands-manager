/**
 * Tests unitaires de `RegisterUseCase` - doubles littéraux simples (`vi.fn()`),
 * aucun module NestJS, même style que `jwt.strategy.spec.ts`.
 *
 * Le cas central (P0-6) : un `ICaptchaVerifier` qui rejette doit couper AVANT
 * `hasher.hash` - la preuve que le captcha protège le coût bcrypt (~100 ms),
 * pas seulement qu'il finit par renvoyer une erreur.
 */
import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainException } from '../../shared/domain/domain-exception';
import type { ICaptchaVerifier } from '../domain/captcha-verifier.interface';
import type { IPasswordHasher } from '../domain/password-hasher.interface';
import type { ITokenIssuer } from '../domain/token-issuer.interface';
import type { IUserRepository } from '../domain/user.repository.interface';
import type { RegisterDto } from '../dto/register.dto';
import { RegisterUseCase } from './register.usecase';

describe('RegisterUseCase', () => {
  const dto: RegisterDto = {
    firstName: 'Max',
    lastName: 'Rockatansky',
    pseudo: 'MadMax',
    email: 'max@test.com',
    password: 'interceptor',
    captchaToken: 'a-valid-token',
    remoteIp: '1.2.3.4',
  };

  const mockUserRepo: IUserRepository = {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    findAll: vi.fn(),
    findAdmin: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
  };

  const mockHasher: IPasswordHasher = {
    hash: vi.fn(async (plain: string) => `hashed:${plain}`),
    compare: vi.fn(),
  };

  const mockTokenIssuer: ITokenIssuer = {
    issue: vi.fn(() => 'signed.jwt.token'),
  };

  const mockCaptchaVerifier: ICaptchaVerifier = {
    assertHuman: vi.fn(async () => undefined),
  };

  let useCase: RegisterUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    (mockHasher.hash as ReturnType<typeof vi.fn>).mockImplementation(async (plain: string) => `hashed:${plain}`);
    (mockTokenIssuer.issue as ReturnType<typeof vi.fn>).mockReturnValue('signed.jwt.token');
    (mockCaptchaVerifier.assertHuman as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (mockUserRepo.save as ReturnType<typeof vi.fn>).mockImplementation(async (user) => user);
    useCase = new RegisterUseCase(mockUserRepo, mockHasher, mockTokenIssuer, mockCaptchaVerifier);
  });

  it('vérifie le captcha puis inscrit normalement quand il est accepté', async () => {
    const result = await useCase.execute(dto);

    expect(mockCaptchaVerifier.assertHuman).toHaveBeenCalledWith(dto.captchaToken, dto.remoteIp);
    expect(mockHasher.hash).toHaveBeenCalledWith(dto.password);
    expect(mockUserRepo.save).toHaveBeenCalled();
    expect(result.access_token).toBe('signed.jwt.token');
  });

  it('rejette avec BadRequestException si le captcha échoue, SANS jamais hacher le mot de passe', async () => {
    (mockCaptchaVerifier.assertHuman as ReturnType<typeof vi.fn>).mockRejectedValue(
      new DomainException('Vérification anti-robot échouée'),
    );

    await expect(useCase.execute(dto)).rejects.toThrow(BadRequestException);

    // Preuve que le rejet coupe avant le coût bcrypt (~100 ms) - pas
    // seulement que l'inscription échoue au final.
    expect(mockHasher.hash).not.toHaveBeenCalled();
    expect(mockUserRepo.save).not.toHaveBeenCalled();
  });
});
