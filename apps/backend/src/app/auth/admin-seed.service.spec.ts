/**
 * Tests unitaires pour AdminSeedService.
 *
 * Stratégie : mock du Repository TypeORM + mock du module bcrypt + mock
 * de ConfigService (cf. user.service.spec.ts pour le pattern vi.mock('bcrypt')).
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('bcrypt');

import * as bcrypt from 'bcrypt';
import { AdminSeedService } from './admin-seed.service';
import { User, UserRole } from './user.entity';

describe('AdminSeedService', () => {
  let service: AdminSeedService;

  const mockRepo = {
    findOne: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
  };

  const mockConfig = {
    get: vi.fn(),
    getOrThrow: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfig.get.mockReturnValue('admin@gaslands.local');
    mockConfig.getOrThrow.mockReturnValue('superSecret123');

    service = new AdminSeedService(mockRepo as never, mockConfig as never);
  });

  it("crée le compte admin s'il n'existe aucun admin", async () => {
    mockRepo.findOne.mockResolvedValue(null);
    vi.mocked(bcrypt.hash).mockResolvedValue('$2b$10$hashed' as never);
    mockRepo.create.mockReturnValue({ email: 'admin@gaslands.local', role: UserRole.ADMIN });
    mockRepo.save.mockResolvedValue({});

    await service.onModuleInit();

    expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { role: UserRole.ADMIN } });
    expect(bcrypt.hash).toHaveBeenCalledWith('superSecret123', 10);
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'admin@gaslands.local',
        password: '$2b$10$hashed',
        role: UserRole.ADMIN,
      }),
    );
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
  });

  it('ne fait rien si un admin existe déjà et que le mot de passe est inchangé', async () => {
    const existingAdmin = {
      id: 1,
      email: 'admin@gaslands.local',
      password: '$2b$10$currentHash',
      role: UserRole.ADMIN,
    } as User;
    mockRepo.findOne.mockResolvedValue(existingAdmin);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    await service.onModuleInit();

    expect(bcrypt.compare).toHaveBeenCalledWith('superSecret123', '$2b$10$currentHash');
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('resynchronise le mot de passe admin si .env a changé', async () => {
    const existingAdmin = {
      id: 1,
      email: 'admin@gaslands.local',
      password: '$2b$10$oldHash',
      role: UserRole.ADMIN,
    } as User;
    mockRepo.findOne.mockResolvedValue(existingAdmin);
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
    vi.mocked(bcrypt.hash).mockResolvedValue('$2b$10$newHash' as never);
    mockRepo.save.mockResolvedValue({});

    await service.onModuleInit();

    expect(bcrypt.hash).toHaveBeenCalledWith('superSecret123', 10);
    expect(mockRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ password: '$2b$10$newHash' }),
    );
  });

  it("ne crée pas de second admin si ADMIN_EMAIL diffère de l'email admin existant", async () => {
    const existingAdmin = {
      id: 1,
      email: 'autre-admin@gaslands.local',
      password: '$2b$10$currentHash',
      role: UserRole.ADMIN,
    } as User;
    mockRepo.findOne.mockResolvedValue(existingAdmin);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    await service.onModuleInit();

    expect(mockRepo.create).not.toHaveBeenCalled();
    expect(mockRepo.findOne).toHaveBeenCalledTimes(1);
  });
});
