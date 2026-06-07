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
 * - vehicleCount : calculé via un vrai COUNT SQL sur Repository<Vehicle> (cf. countVehicles),
 *   jamais une valeur en dur — on mocke donc AUSSI ce second Repository.
 */

import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Team } from './team.entity';
import { Vehicle } from '../vehicle/vehicle.entity';
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

  // Mock du Repository<Vehicle> — UNIQUEMENT pour `count` (cf. `countVehicles` :
  // TeamService ne lit/écrit jamais de véhicule, il se contente de les compter).
  const mockVehicleRepo = {
    count: vi.fn(),
  };

  beforeEach(async () => {
    // Test.createTestingModule() crée un module NestJS minimal pour les tests
    // On injecte les mocks à la place des vrais Repository<Team>/Repository<Vehicle>
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamService,
        {
          // getRepositoryToken(Team) retourne le token d'injection de TypeORM
          // C'est ce que @InjectRepository(Team) utilise dans le constructeur
          provide: getRepositoryToken(Team),
          useValue: mockRepo,
        },
        {
          provide: getRepositoryToken(Vehicle),
          useValue: mockVehicleRepo,
        },
      ],
    }).compile();

    service = module.get<TeamService>(TeamService);
    // On remet tous les mocks à zéro entre chaque test pour éviter les interférences
    vi.clearAllMocks();
  });

  // ── findByUserId ────────────────────────────────────────────────────────────

  describe('findByUserId()', () => {
    it('retourne les équipes de l\'utilisateur enrichies avec vehicleCount calculé via COUNT SQL', async () => {
      mockRepo.find.mockResolvedValue([mockTeam]);
      // Le COUNT renvoie 3 — on vérifie que le service le RESTITUE fidèlement,
      // pas une valeur en dur (cf. ancienne version, qui retournait toujours 0).
      mockVehicleRepo.count.mockResolvedValue(3);

      const result = await service.findByUserId(42);

      // Vérifie que le Repository est appelé avec le bon filtre userId
      expect(mockRepo.find).toHaveBeenCalledWith({ where: { userId: 42 } });
      // Le comptage doit cibler LA bonne équipe (filtre teamId = id de mockTeam)
      expect(mockVehicleRepo.count).toHaveBeenCalledWith({ where: { teamId: mockTeam.id } });
      expect(result).toEqual([{ ...mockTeam, vehicleCount: 3 }]);
    });

    it('retourne un tableau vide si l\'utilisateur n\'a aucune équipe', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.findByUserId(99);

      expect(result).toEqual([]);
      // Aucune équipe ⇒ aucun comptage à effectuer (rien à itérer)
      expect(mockVehicleRepo.count).not.toHaveBeenCalled();
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
    it('met à jour une équipe existante et recalcule vehicleCount via COUNT SQL', async () => {
      const dto: UpdateTeamDto = { name: 'Nouveau nom', cans: 75 };
      const updatedTeam = { ...mockTeam, ...dto };

      mockRepo.findOne.mockResolvedValue(mockTeam);
      mockRepo.save.mockResolvedValue(updatedTeam);
      mockVehicleRepo.count.mockResolvedValue(2);

      const result = await service.update(1, 42, dto);

      expect(mockRepo.save).toHaveBeenCalled();
      expect(result.name).toBe('Nouveau nom');
      expect(result.cans).toBe(75);
      // vehicleCount n'est plus une constante : il reflète le COUNT recalculé
      expect(mockVehicleRepo.count).toHaveBeenCalledWith({ where: { teamId: updatedTeam.id } });
      expect(result.vehicleCount).toBe(2);
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
