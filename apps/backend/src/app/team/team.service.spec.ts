/**
 * Tests unitaires pour TeamService.
 *
 * Objectif : tester la logique métier du service en isolation totale.
 * On mock le Repository<Team> pour ne jamais toucher la base de données.
 *
 * Concepts clés testés :
 * - Isolation utilisateur : chaque méthode filtre par userId
 * - Gestion d'erreur : NotFoundException si équipe introuvable ou appartenant à un autre user
 * - Délégation : le service appelle bien les bonnes méthodes du Repository
 */

import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Team } from './team.entity';
import { TeamService } from './team.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

// Équipe fictive pour les tests
const mockTeam: Team = {
  id: 1,
  name: 'Les Furieux du Désert',
  sponsor: 'Rutherford',
  cans: 50,
  description: 'Une équipe redoutable',
  userId: 42,
  user: null as never, // la relation User n'est pas chargée dans les tests unitaires
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

describe('TeamService', () => {
  let service: TeamService;

  // Mock du Repository<Team> : on remplace toutes les méthodes par des vi.fn()
  // Cela permet de contrôler ce que retourne la base de données dans chaque test
  const mockRepo = {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    // Test.createTestingModule() crée un module NestJS minimal pour les tests
    // On injecte le mockRepo à la place du vrai Repository<Team>
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamService,
        {
          // getRepositoryToken(Team) retourne le token d'injection de TypeORM
          // C'est ce que @InjectRepository(Team) utilise dans le constructeur
          provide: getRepositoryToken(Team),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<TeamService>(TeamService);
    // On remet tous les mocks à zéro entre chaque test pour éviter les interférences
    vi.clearAllMocks();
  });

  // ── findByUserId ────────────────────────────────────────────────────────────

  describe('findByUserId()', () => {
    it('retourne les équipes de l\'utilisateur', async () => {
      mockRepo.find.mockResolvedValue([mockTeam]);

      const result = await service.findByUserId(42);

      // Vérifie que le Repository est appelé avec le bon filtre userId
      expect(mockRepo.find).toHaveBeenCalledWith({ where: { userId: 42 } });
      expect(result).toEqual([mockTeam]);
    });

    it('retourne un tableau vide si l\'utilisateur n\'a aucune équipe', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.findByUserId(99);

      expect(result).toEqual([]);
    });
  });

  // ── findOneForUser ──────────────────────────────────────────────────────────

  describe('findOneForUser()', () => {
    it('retourne l\'équipe si elle appartient à l\'utilisateur', async () => {
      mockRepo.findOne.mockResolvedValue(mockTeam);

      const result = await service.findOneForUser(1, 42);

      // La requête doit filtrer sur id ET userId simultanément
      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 1, userId: 42 } });
      expect(result).toEqual(mockTeam);
    });

    it('lève NotFoundException si l\'équipe n\'existe pas', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findOneForUser(999, 42)).rejects.toThrow(NotFoundException);
    });

    it('lève NotFoundException si l\'équipe appartient à un autre utilisateur', async () => {
      // findOne retourne null car la clause WHERE id=1 AND userId=99 ne trouve rien
      // (l'équipe id=1 appartient à userId=42, pas 99)
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findOneForUser(1, 99)).rejects.toThrow(NotFoundException);
    });
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('crée une équipe et la lie à l\'utilisateur', async () => {
      const dto: CreateTeamDto = {
        name: 'Nouvelle équipe',
        sponsor: 'Miyazaki',
        cans: 60,
      };

      // create() instancie l'objet, save() l'écrit en base
      mockRepo.create.mockReturnValue({ ...dto, userId: 42 });
      mockRepo.save.mockResolvedValue({ id: 2, ...dto, userId: 42 });

      const result = await service.create(42, dto);

      // Le userId doit être forcé par le service, pas pris du DTO
      expect(mockRepo.create).toHaveBeenCalledWith({ ...dto, userId: 42 });
      expect(mockRepo.save).toHaveBeenCalled();
      expect(result.userId).toBe(42);
    });
  });

  // ── update ──────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('met à jour une équipe existante', async () => {
      const dto: UpdateTeamDto = { name: 'Nouveau nom', cans: 75 };
      const updatedTeam = { ...mockTeam, ...dto };

      mockRepo.findOne.mockResolvedValue(mockTeam);
      mockRepo.save.mockResolvedValue(updatedTeam);

      const result = await service.update(1, 42, dto);

      expect(mockRepo.save).toHaveBeenCalled();
      expect(result.name).toBe('Nouveau nom');
      expect(result.cans).toBe(75);
    });

    it('lève NotFoundException si l\'équipe n\'appartient pas à l\'utilisateur', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.update(1, 99, { name: 'Hack' })).rejects.toThrow(NotFoundException);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── remove ──────────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('supprime l\'équipe de l\'utilisateur', async () => {
      mockRepo.findOne.mockResolvedValue(mockTeam);
      mockRepo.remove.mockResolvedValue(undefined);

      await service.remove(1, 42);

      expect(mockRepo.remove).toHaveBeenCalledWith(mockTeam);
    });

    it('lève NotFoundException si l\'équipe n\'appartient pas à l\'utilisateur', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.remove(1, 99)).rejects.toThrow(NotFoundException);
      expect(mockRepo.remove).not.toHaveBeenCalled();
    });
  });
});
