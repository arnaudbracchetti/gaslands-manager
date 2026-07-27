/**
 * Tests unitaires pour UserService.
 *
 * Stratégie : mock du Repository TypeORM + mock du module bcrypt.
 *
 * Note ESM + Vitest :
 * vi.spyOn() ne fonctionne pas sur les exports ESM (non reconfigurables).
 * Solution : vi.mock('bcrypt') hisse automatiquement le mock en haut du fichier
 * AVANT les imports, remplaçant toutes les fonctions du module par des vi.fn().
 * C'est la façon standard de mocker des modules tiers dans Vitest.
 */

import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
// vi.mock() doit être appelé avant les imports du module à mocker —
// Vitest le hisse automatiquement grâce à son système de transformation.
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock automatique du module bcrypt : toutes ses fonctions deviennent des vi.fn()
vi.mock('bcrypt');

// L'import se fait APRÈS vi.mock() — les fonctions importées sont déjà des mocks
import * as bcrypt from 'bcrypt';
import { UserOrm, UserRole } from './user.entity';
import { UserService } from './user.service';

const mockUser: UserOrm = {
  id: 1,
  firstName: 'Jean',
  lastName: 'Dupont',
  email: 'jean@test.com',
  password: '$2b$10$hashedpassword',
  role: UserRole.USER,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UserService', () => {
  let service: UserService;

  const mockRepo = {
    findOne: vi.fn(),
    find: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(UserOrm), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    vi.clearAllMocks();
  });

  // ── findByEmail ────────────────────────────────────────────────────────────

  describe('findByEmail()', () => {
    it('retourne l\'utilisateur si l\'email existe', async () => {
      mockRepo.findOne.mockResolvedValue(mockUser);

      const result = await service.findByEmail('jean@test.com');

      expect(result).toEqual(mockUser);
      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { email: 'jean@test.com' } });
    });

    it('retourne null si l\'email n\'existe pas', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('inconnu@test.com');

      expect(result).toBeNull();
    });
  });

  // ── findById ───────────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('retourne l\'utilisateur SANS le champ password', async () => {
      mockRepo.findOne.mockResolvedValue(mockUser);

      const result = await service.findById(1);

      expect(result).not.toHaveProperty('password');
      expect(result).toMatchObject({ id: 1, firstName: 'Jean', email: 'jean@test.com' });
    });

    it('retourne null si l\'utilisateur n\'existe pas', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.findById(999);

      expect(result).toBeNull();
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('hache le mot de passe et crée l\'utilisateur', async () => {
      const dto = { firstName: 'Jean', lastName: 'Dupont', email: 'jean@test.com', password: 'plain123' };

      // Grâce à vi.mock('bcrypt'), bcrypt.hash est déjà un vi.fn() — on configure sa valeur de retour
      vi.mocked(bcrypt.hash).mockResolvedValue('$2b$10$mocked' as never);
      mockRepo.create.mockReturnValue({ ...mockUser, password: '$2b$10$mocked' });
      mockRepo.save.mockResolvedValue({ ...mockUser, password: '$2b$10$mocked' });

      const result = await service.create(dto);

      expect(bcrypt.hash).toHaveBeenCalledWith('plain123', 10);
      expect(result).not.toHaveProperty('password');
    });

    it('lève ConflictException si l\'email est déjà utilisé (erreur PostgreSQL 23505)', async () => {
      const dto = { firstName: 'Jean', lastName: 'Dupont', email: 'jean@test.com', password: 'plain123' };

      vi.mocked(bcrypt.hash).mockResolvedValue('$2b$10$mocked' as never);
      mockRepo.create.mockReturnValue(mockUser);
      // Simule l'erreur PostgreSQL de contrainte unique (code 23505)
      mockRepo.save.mockRejectedValue({ code: '23505' });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  // ── findEntityById ─────────────────────────────────────────────────────────

  describe('findEntityById()', () => {
    it('retourne l\'utilisateur AVEC le champ password', async () => {
      mockRepo.findOne.mockResolvedValue(mockUser);

      const result = await service.findEntityById(1);

      expect(result).toHaveProperty('password');
      expect(result).toEqual(mockUser);
    });

    it('retourne null si l\'utilisateur n\'existe pas', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.findEntityById(999);

      expect(result).toBeNull();
    });
  });

  // ── updateProfile ──────────────────────────────────────────────────────────

  describe('updateProfile()', () => {
    const dto = { firstName: 'Jeanne', lastName: 'Martin', email: 'jeanne@test.com' };

    it('met à jour firstName/lastName/email et retourne l\'utilisateur SANS le champ password', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockUser });
      mockRepo.save.mockResolvedValue({ ...mockUser, ...dto });

      const result = await service.updateProfile(1, dto);

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'Jeanne', lastName: 'Martin', email: 'jeanne@test.com' }),
      );
      expect(result).not.toHaveProperty('password');
      expect(result).toMatchObject(dto);
    });

    it('normalise l\'email (lowercase + trim)', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockUser });
      mockRepo.save.mockResolvedValue({ ...mockUser });

      await service.updateProfile(1, { ...dto, email: '  Jeanne@Test.com  ' });

      expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ email: 'jeanne@test.com' }));
    });

    it('lève NotFoundException si l\'utilisateur n\'existe pas', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.updateProfile(999, dto)).rejects.toThrow(NotFoundException);
    });

    it('lève ConflictException si l\'email est déjà utilisé par un autre compte (erreur PostgreSQL 23505)', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockUser });
      mockRepo.save.mockRejectedValue({ code: '23505' });

      await expect(service.updateProfile(1, dto)).rejects.toThrow(ConflictException);
    });
  });

  // ── updatePassword ─────────────────────────────────────────────────────────

  describe('updatePassword()', () => {
    it('hache le nouveau mot de passe (coût 10) et met à jour l\'utilisateur', async () => {
      vi.mocked(bcrypt.hash).mockResolvedValue('$2b$10$newhash' as never);
      mockRepo.update.mockResolvedValue({ affected: 1 });

      await service.updatePassword(1, 'nouveauMotDePasse');

      expect(bcrypt.hash).toHaveBeenCalledWith('nouveauMotDePasse', 10);
      expect(mockRepo.update).toHaveBeenCalledWith(1, { password: '$2b$10$newhash' });
    });
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('retourne tous les utilisateurs SANS le champ password', async () => {
      mockRepo.find.mockResolvedValue([mockUser]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('password');
      expect(result[0]).toMatchObject({ id: 1, email: 'jean@test.com' });
    });
  });

  // ── remove ─────────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('lève ForbiddenException si l\'admin tente de se supprimer lui-même', async () => {
      await expect(service.remove(1, 1)).rejects.toThrow(ForbiddenException);
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });

    it('lève NotFoundException si l\'utilisateur n\'existe pas', async () => {
      mockRepo.delete.mockResolvedValue({ affected: 0 });

      await expect(service.remove(999, 1)).rejects.toThrow(NotFoundException);
    });

    it('supprime l\'utilisateur si tout est valide', async () => {
      mockRepo.delete.mockResolvedValue({ affected: 1 });

      await service.remove(2, 1);

      expect(mockRepo.delete).toHaveBeenCalledWith(2);
    });
  });

  // ── setActive ──────────────────────────────────────────────────────────────

  describe('setActive()', () => {
    it('lève ForbiddenException si l\'admin tente de modifier son propre statut', async () => {
      await expect(service.setActive(1, 1, false)).rejects.toThrow(ForbiddenException);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('lève NotFoundException si l\'utilisateur n\'existe pas', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.setActive(999, 1, false)).rejects.toThrow(NotFoundException);
    });

    it('désactive le compte et retourne l\'utilisateur SANS le champ password', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockUser, id: 2 });
      mockRepo.save.mockResolvedValue({ ...mockUser, id: 2, isActive: false });

      const result = await service.setActive(2, 1, false);

      expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 2, isActive: false }));
      expect(result).not.toHaveProperty('password');
      expect(result.isActive).toBe(false);
    });
  });
});
