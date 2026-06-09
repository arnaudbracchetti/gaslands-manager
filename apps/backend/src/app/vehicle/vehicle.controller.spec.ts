/**
 * Tests unitaires pour VehicleController.
 *
 * Mirroir de `weapon.controller.spec.ts` (cf. son en-tête — c'est lui qui a posé
 * le pattern de test "câblage HTTP" pour ce module, repris ici tel quel) :
 * objectif unique, vérifier que chaque endpoint appelle la bonne méthode de
 * `VehicleService`, avec les bons arguments, et restitue son résultat tel quel.
 * On mock `VehicleService` pour tester le controller en isolation totale. On ne
 * teste PAS ici : la logique métier (→ vehicle.service.spec.ts), ni l'authentification
 * JWT (testée par `JwtAuthGuard` en intégration).
 *
 * Fichier créé à l'occasion de l'ajout des routes de retrait/suppression — il
 * comblait une lacune préexistante (`VehicleController` n'avait encore aucun
 * test dédié, contrairement à `WeaponController`/`TeamController`).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { VehicleController } from './vehicle.controller';
import { VehicleService } from './vehicle.service';
import type { Vehicle } from './vehicle.entity';
import { ok } from './vehicle-build';
import type { VehicleBuild, VehicleStats } from './vehicle-build';
import type { VehicleDto } from './dto/vehicle.dto';

// Simulacre d'utilisateur connecté (ce que JwtStrategy injecte dans req.user —
// même contrat que `team.controller.spec.ts`/`WeaponController`).
const mockUser = { id: 42, email: 'test@test.com' };
const mockRequest = { user: mockUser };

// Véhicule fictif retourné par VehicleService.addImprovement (entité brute,
// avant passage dans toVehicleDto — cf. `mockVehicle` de `weapon.controller.spec.ts`).
const mockVehicle: Partial<Vehicle> = { id: 7, nomInterne: 'camion' };

// DTO fictif retourné par VehicleService.toVehicleDto — c'est ce que le
// contrôleur finit par retourner au client HTTP après l'ajout d'une amélioration.
const mockVehicleDto: VehicleDto = {
  id: 7,
  nomInterne: 'camion',
  teamId: 1,
  createdAt: new Date('2024-01-01'),
  improvements: [],
  weapons: [],
};

const statsParDefaut: VehicleStats = {
  nom_interne: 'camion',
  poids: 'Moyen',
  carrosserie: 14,
  manoeuvrabilite: 1,
  vitesse_max: 6,
  equipage: 2,
  emplacements: 5,
};

// Double minimal pour `VehicleBuild` — `getOne` n'a besoin que de lire `stats`/
// `baseStats`/`describe()` pour construire son DTO (cf. `VehicleController.getOne`).
const mockBuild: VehicleBuild = {
  stats: statsParDefaut,
  baseStats: statsParDefaut,
  describe: () => ['Camion — 14 carrosserie'],
  countByType: () => 0,
  hasOrientationFor: () => false,
  totalEmplacements: () => 0,
  validate: () => ok(),
};

describe('VehicleController', () => {
  let controller: VehicleController;

  const mockVehicleService = {
    findOneForUser: vi.fn(),
    getBuild: vi.fn(),
    getAvailableImprovements: vi.fn(),
    addImprovement: vi.fn(),
    // toVehicleDto est appelé par addImprovement() pour transformer l'entité brute
    // en DTO sérialisable avec `prix` calculé (cf. VehicleController.addImprovement).
    toVehicleDto: vi.fn(),
    removeImprovement: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VehicleController],
      providers: [{ provide: VehicleService, useValue: mockVehicleService }],
    }).compile();

    controller = module.get<VehicleController>(VehicleController);
    vi.clearAllMocks();
  });

  // ── GET /vehicles/:id ────────────────────────────────────────────────────────

  describe('getOne()', () => {
    it('charge le véhicule, reconstitue sa chaîne et restitue un VehicleDetailDto', async () => {
      mockVehicleService.findOneForUser.mockResolvedValue(mockVehicle);
      mockVehicleService.getBuild.mockReturnValue(mockBuild);

      const result = await controller.getOne(7, mockRequest as never);

      expect(mockVehicleService.findOneForUser).toHaveBeenCalledWith(7, 42);
      expect(mockVehicleService.getBuild).toHaveBeenCalledWith(mockVehicle);
      // Le controller n'expose QUE le résultat calculé — jamais la chaîne elle-même
      // (cf. son en-tête : le client HTTP ignore le Pattern Decorator).
      expect(result).toEqual({
        id: 7,
        nomInterne: 'camion',
        stats: statsParDefaut,
        baseStats: statsParDefaut,
        recapitulatif: ['Camion — 14 carrosserie'],
      });
    });
  });

  // ── GET /vehicles/:id/available-improvements ────────────────────────────────

  describe('getAvailableImprovements()', () => {
    it('appelle VehicleService.getAvailableImprovements avec l\'id du véhicule et l\'id de l\'utilisateur connecté', async () => {
      const dtos = [{ nom: 'Chenilles', nomInterne: 'chenilles', prix: 4, emplacement: 1, disponible: true }];
      mockVehicleService.getAvailableImprovements.mockResolvedValue(dtos);

      const result = await controller.getAvailableImprovements(7, mockRequest as never);

      // Le controller doit passer req.user.id (pas req.user) — convention partagée
      // avec WeaponController/TeamController (cf. leur en-tête).
      expect(mockVehicleService.getAvailableImprovements).toHaveBeenCalledWith(7, 42);
      expect(result).toEqual(dtos);
    });
  });

  // ── POST /vehicles/:id/improvements ──────────────────────────────────────────

  describe('addImprovement()', () => {
    it('appelle VehicleService.addImprovement puis toVehicleDto, et retourne le DTO enrichi', async () => {
      // addImprovement retourne l'entité brute ; toVehicleDto la transforme en DTO
      // sérialisable avec `prix` calculé (getters). On vérifie la chaîne complète —
      // même pattern que `weapon.controller.spec.ts > addWeapon()`.
      mockVehicleService.addImprovement.mockResolvedValue(mockVehicle);
      mockVehicleService.toVehicleDto.mockReturnValue(mockVehicleDto);
      const dto = { nomInterne: 'belier', orientation: 'avant' as const };

      const result = await controller.addImprovement(7, mockRequest as never, dto);

      expect(mockVehicleService.addImprovement).toHaveBeenCalledWith(7, 42, 'belier', { orientation: 'avant' });
      // toVehicleDto est appelé avec le résultat brut de addImprovement
      expect(mockVehicleService.toVehicleDto).toHaveBeenCalledWith(mockVehicle);
      // Le controller retourne le DTO, pas l'entité brute
      expect(result).toEqual(mockVehicleDto);
    });

    it('transmet `orientation: undefined` telle quelle pour une amélioration non orientée', async () => {
      mockVehicleService.addImprovement.mockResolvedValue(mockVehicle);
      mockVehicleService.toVehicleDto.mockReturnValue(mockVehicleDto);
      const dto = { nomInterne: 'chenilles' };

      await controller.addImprovement(7, mockRequest as never, dto);

      // Le controller ne tranche AUCUNE règle — il relaie tel quel ce que le
      // client a fourni ; c'est `VehicleService.canAddImprovement` qui statue.
      expect(mockVehicleService.addImprovement).toHaveBeenCalledWith(7, 42, 'chenilles', { orientation: undefined });
    });
  });

  // ── DELETE /vehicles/:id/improvements/:improvementId ────────────────────────

  describe('removeImprovement()', () => {
    it('appelle VehicleService.removeImprovement avec id du véhicule, id de l\'amélioration et userId', async () => {
      mockVehicleService.removeImprovement.mockResolvedValue(undefined);

      await controller.removeImprovement(7, 1, mockRequest as never);

      expect(mockVehicleService.removeImprovement).toHaveBeenCalledWith(7, 1, 42);
    });
  });

  // ── DELETE /vehicles/:id ─────────────────────────────────────────────────────

  describe('remove()', () => {
    it('appelle VehicleService.remove avec id et userId', async () => {
      mockVehicleService.remove.mockResolvedValue(undefined);

      await controller.remove(7, mockRequest as never);

      expect(mockVehicleService.remove).toHaveBeenCalledWith(7, 42);
    });
  });
});
