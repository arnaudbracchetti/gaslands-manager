/**
 * Tests unitaires pour WeaponController.
 *
 * Mirroir de `team.controller.spec.ts` (cf. son en-tête — pattern qu'aucun
 * controller du module `vehicle` n'avait encore posé pour ce type de test) :
 * objectif unique, vérifier le CÂBLAGE HTTP — chaque endpoint appelle la bonne
 * méthode de `WeaponService` (et `VehicleService.toVehicleDto` pour `addWeapon`),
 * avec les bons arguments, et restitue le résultat attendu. On mock les deux
 * services pour tester le controller en isolation. On ne teste PAS ici : la
 * logique métier (→ weapon.service.spec.ts),
 * ni l'authentification JWT (testée par `JwtAuthGuard` en intégration).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { WeaponController } from './weapon.controller';
import { WeaponService } from './weapon.service';
import { VehicleService } from '../vehicle/vehicle.service';
import type { Vehicle } from '../vehicle/vehicle.entity';
import type { VehicleDto } from '../vehicle/dto/vehicle.dto';

// Simulacre d'utilisateur connecté (ce que JwtStrategy injecte dans req.user —
// même contrat que `team.controller.spec.ts`/`VehicleController`).
const mockUser = { id: 42, email: 'test@test.com' };
const mockRequest = { user: mockUser };

// Véhicule fictif retourné par WeaponService.addWeapon (entité brute, avant
// passage dans toVehicleDto). Seul `id` nous intéresse ici.
const mockVehicle: Partial<Vehicle> = { id: 7, nomInterne: 'camion' };

// DTO fictif retourné par VehicleService.toVehicleDto — c'est ce que le
// contrôleur finit par retourner au client HTTP après l'appel à addWeapon.
const mockVehicleDto: VehicleDto = {
  id: 7,
  nomInterne: 'camion',
  teamId: 1,
  createdAt: new Date('2024-01-01'),
  improvements: [],
  weapons: [],
};

describe('WeaponController', () => {
  let controller: WeaponController;

  const mockWeaponService = {
    getAvailableWeapons: vi.fn(),
    addWeapon: vi.fn(),
    removeWeapon: vi.fn(),
  };

  // VehicleService mocké — WeaponController l'injecte pour appeler toVehicleDto
  // après ajout d'une arme (transformation entité → DTO sérialisable).
  // On ne mock que la méthode réellement appelée par le contrôleur.
  const mockVehicleService = {
    toVehicleDto: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WeaponController],
      providers: [
        { provide: WeaponService, useValue: mockWeaponService },
        { provide: VehicleService, useValue: mockVehicleService },
      ],
    }).compile();

    controller = module.get<WeaponController>(WeaponController);
    vi.clearAllMocks();
  });

  // ── GET /vehicles/:id/available-weapons ─────────────────────────────────────

  describe('getAvailableWeapons()', () => {
    it('appelle WeaponService.getAvailableWeapons avec l\'id du véhicule et l\'id de l\'utilisateur connecté', async () => {
      const dtos = [{ nom: 'Mitrailleuse', nomInterne: 'mitrailleuse', prix: 4, emplacement: 1, type: 'base' as const, disponible: true }];
      mockWeaponService.getAvailableWeapons.mockResolvedValue(dtos);

      const result = await controller.getAvailableWeapons(7, mockRequest as never);

      // Le controller doit passer req.user.id (pas req.user) — convention partagée
      // avec VehicleController/TeamController (cf. leur en-tête).
      expect(mockWeaponService.getAvailableWeapons).toHaveBeenCalledWith(7, 42);
      expect(result).toEqual(dtos);
    });
  });

  // ── POST /vehicles/:id/weapons ──────────────────────────────────────────────

  describe('addWeapon()', () => {
    it('appelle WeaponService.addWeapon puis VehicleService.toVehicleDto, et retourne le DTO enrichi', async () => {
      // addWeapon retourne l'entité brute ; toVehicleDto la transforme en DTO
      // sérialisable avec `prix` calculé (getters). On vérifie la chaîne complète.
      mockWeaponService.addWeapon.mockResolvedValue(mockVehicle);
      mockVehicleService.toVehicleDto.mockReturnValue(mockVehicleDto);
      const dto = { nomInterne: 'mitrailleuse', orientation: 'avant' as const };

      const result = await controller.addWeapon(7, mockRequest as never, dto);

      expect(mockWeaponService.addWeapon).toHaveBeenCalledWith(7, 42, 'mitrailleuse', 'avant');
      // toVehicleDto est appelé avec le résultat brut de addWeapon
      expect(mockVehicleService.toVehicleDto).toHaveBeenCalledWith(mockVehicle);
      // Le controller retourne le DTO, pas l'entité brute
      expect(result).toEqual(mockVehicleDto);
    });

    it('transmet `orientation: undefined` telle quelle pour une arme d\'équipage (le DTO ne préjuge de rien)', async () => {
      mockWeaponService.addWeapon.mockResolvedValue(mockVehicle);
      mockVehicleService.toVehicleDto.mockReturnValue(mockVehicleDto);
      const dto = { nomInterne: 'grenades' };

      await controller.addWeapon(7, mockRequest as never, dto);

      // Le controller ne tranche AUCUNE règle — il relaie tel quel ce que le
      // client a fourni ; c'est `WeaponService.canAddWeapon` qui statue
      // (cf. son en-tête : la cohérence orientation/type est une règle de FOND).
      expect(mockWeaponService.addWeapon).toHaveBeenCalledWith(7, 42, 'grenades', undefined);
    });
  });

  // ── DELETE /weapons/:id ─────────────────────────────────────────────────────

  describe('removeWeapon()', () => {
    it('appelle WeaponService.removeWeapon avec id et userId', async () => {
      mockWeaponService.removeWeapon.mockResolvedValue(undefined);

      await controller.removeWeapon(9, mockRequest as never);

      expect(mockWeaponService.removeWeapon).toHaveBeenCalledWith(9, 42);
    });
  });
});
