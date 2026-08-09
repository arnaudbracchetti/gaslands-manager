/**
 * Tests unitaires de `ImpersonateUserUseCase` - même style que
 * `register.usecase.spec.ts`. La garde métier réelle (rôle, compte actif) est
 * déjà couverte par `user.spec.ts` (`assertImpersonatableBy`) - ici on vérifie
 * seulement l'orchestration : traduction en 403, forme de la réponse.
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ITokenIssuer } from '../domain/token-issuer.interface';
import { User } from '../domain/user';
import { UserRole } from '../domain/user-role';
import type { IUserRepository } from '../domain/user.repository.interface';
import { ImpersonateUserUseCase } from './impersonate-user.usecase';

function buildUser(role: UserRole): User {
  return new User(2, 'Jean', 'Dupont', 'JeanLeFou', 'jean@test.com', 'hashed:x', role, true, new Date(), new Date());
}

describe('ImpersonateUserUseCase', () => {
  const mockUserRepo: IUserRepository = {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    findAll: vi.fn(),
    findAdmin: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
  };

  const mockTokenIssuer: ITokenIssuer = {
    issue: vi.fn(() => 'signed.jwt.token'),
  };

  let useCase: ImpersonateUserUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    (mockTokenIssuer.issue as ReturnType<typeof vi.fn>).mockReturnValue('signed.jwt.token');
    useCase = new ImpersonateUserUseCase(mockUserRepo, mockTokenIssuer);
  });

  it('émet un token pour un compte USER et retourne la même forme que le login', async () => {
    (mockUserRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(buildUser(UserRole.USER));

    const result = await useCase.execute({ targetUserId: 2 });

    expect(mockTokenIssuer.issue).toHaveBeenCalled();
    expect(result).toEqual({ access_token: 'signed.jwt.token', user: expect.objectContaining({ id: 2 }) });
  });

  it('refuse (403) l\'usurpation d\'un compte ADMIN', async () => {
    (mockUserRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(buildUser(UserRole.ADMIN));

    await expect(useCase.execute({ targetUserId: 2 })).rejects.toThrow(ForbiddenException);
    expect(mockTokenIssuer.issue).not.toHaveBeenCalled();
  });

  it('renvoie 404 si le compte cible n\'existe pas', async () => {
    (mockUserRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(useCase.execute({ targetUserId: 999 })).rejects.toThrow(NotFoundException);
  });
});
