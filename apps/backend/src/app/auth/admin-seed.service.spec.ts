/**
 * Tests unitaires pour AdminSeedService.
 *
 * Depuis la refonte DDD, ce spec n'a plus besoin de `vi.mock('bcrypt')` ni d'un
 * faux Repository TypeORM : le service ne parle qu'à `IUserRepository` et
 * `IPasswordHasher`, deux interfaces du domaine qu'un objet littéral suffit à
 * satisfaire.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AdminSeedService } from './admin-seed.service';
import type { IPasswordHasher } from './domain/password-hasher.interface';
import { User } from './domain/user';
import { UserRole } from './domain/user-role';

const hasher: IPasswordHasher = {
  hash: vi.fn(async (plain: string) => `hashed:${plain}`),
  compare: vi.fn(async (plain: string, hash: string) => hash === `hashed:${plain}`),
};

function existingAdmin(overrides: { email?: string; passwordHash?: string } = {}): User {
  return new User(
    1,
    'Admin',
    'Gaslands',
    'Admin',
    overrides.email ?? 'admin@gaslands.local',
    overrides.passwordHash ?? 'hashed:superSecret123',
    UserRole.ADMIN,
    true,
    new Date(),
    new Date(),
  );
}

describe('AdminSeedService', () => {
  let service: AdminSeedService;

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

    mockConfig.get.mockReturnValue('admin@gaslands.local');
    mockConfig.getOrThrow.mockReturnValue('superSecret123');

    service = new AdminSeedService(mockRepo as never, hasher, mockConfig as never);
  });

  it("crée le compte admin s'il n'existe aucun admin", async () => {
    mockRepo.findAdmin.mockResolvedValue(null);
    mockRepo.save.mockImplementation(async (u: User) => u);

    await service.onModuleInit();

    expect(mockRepo.save).toHaveBeenCalledTimes(1);
    const created = mockRepo.save.mock.calls[0][0] as User;
    expect(created.email).toBe('admin@gaslands.local');
    expect(created.role).toBe(UserRole.ADMIN);
    expect(created.passwordHash).toBe('hashed:superSecret123');
    expect(created.callName).toBe('Admin');
  });

  it('ne fait rien si un admin existe déjà et que le mot de passe est inchangé', async () => {
    mockRepo.findAdmin.mockResolvedValue(existingAdmin());

    await service.onModuleInit();

    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('resynchronise le mot de passe admin si .env a changé', async () => {
    mockRepo.findAdmin.mockResolvedValue(existingAdmin({ passwordHash: 'hashed:ancienMdp' }));
    mockRepo.save.mockImplementation(async (u: User) => u);

    await service.onModuleInit();

    const saved = mockRepo.save.mock.calls[0][0] as User;
    expect(saved.passwordHash).toBe('hashed:superSecret123');
  });

  it("ne crée pas de second admin si ADMIN_EMAIL diffère de l'email admin existant", async () => {
    mockRepo.findAdmin.mockResolvedValue(existingAdmin({ email: 'autre-admin@gaslands.local' }));
    mockRepo.save.mockImplementation(async (u: User) => u);

    await service.onModuleInit();

    // Un seul admin : l'existant est mis à jour (email resynchronisé), jamais dupliqué.
    expect(mockRepo.findAdmin).toHaveBeenCalledTimes(1);
    const saved = mockRepo.save.mock.calls[0][0] as User;
    expect(saved.id).toBe(1);
    expect(saved.email).toBe('admin@gaslands.local');
  });
});
