/**
 * Tests unitaires pour JwtStrategy.
 *
 * Même style que `admin-seed.service.spec.ts` : un `mockRepo` littéral
 * satisfaisant `IUserRepository` et un `mockConfig` satisfaisant l'API de
 * `ConfigService` réellement utilisée (`getOrThrow`) — aucun module de test
 * NestJS, aucun mock de Passport.
 */
import { UnauthorizedException } from '@nestjs/common';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { User } from './domain/user';
import { UserRole } from './domain/user-role';
import { JwtStrategy } from './jwt.strategy';

function buildUser(overrides: Partial<{ id: number; isActive: boolean }> = {}): User {
  return new User(
    overrides.id ?? 1,
    'Max',
    'Rockatansky',
    'MadMax',
    'max@test.com',
    'hashed:interceptor',
    UserRole.USER,
    overrides.isActive ?? true,
    new Date(),
    new Date(),
  );
}

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  const mockRepo = {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    findAll: vi.fn(),
    findAdmin: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
  };

  const mockConfig = {
    get: vi.fn(),
    getOrThrow: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.getOrThrow.mockReturnValue('test-secret');

    strategy = new JwtStrategy(mockConfig as never, mockRepo as never);
  });

  const payload = { sub: 1, email: 'max@test.com', role: UserRole.USER };

  it('résout l\'agrégat User pour un compte actif', async () => {
    mockRepo.findById.mockResolvedValue(buildUser({ isActive: true }));

    await expect(strategy.validate(payload)).resolves.toBeInstanceOf(User);
  });

  it('résout null si le compte a été supprimé depuis l\'émission du token', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(strategy.validate(payload)).resolves.toBeNull();
  });

  it('rejette avec UnauthorizedException si le compte a été désactivé', async () => {
    mockRepo.findById.mockResolvedValue(buildUser({ isActive: false }));

    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });
});
