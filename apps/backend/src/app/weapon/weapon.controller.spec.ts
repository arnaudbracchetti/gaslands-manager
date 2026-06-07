/**
 * Tests unitaires pour WeaponController.
 *
 * Mirroir de `team.controller.spec.ts` (cf. son en-tête — pattern qu'aucun
 * controller du module `vehicle` n'avait encore posé pour ce type de test) :
 * objectif unique, vérifier le CÂBLAGE HTTP — chaque endpoint appelle la bonne
 * méthode de `WeaponService`, avec les bons arguments, et restitue son résultat
 * tel quel. On mock `WeaponService` pour tester le controller en isolation
 * totale. On ne teste PAS ici : la logique métier (→ weapon.service.spec.ts),
 * ni l'authentification JWT (testée par `JwtAuthGuard` en intégration).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { WeaponController } from './weapon.controller';
import { WeaponService } from './weapon.service';
import type { Vehicle } from '../vehicle/vehicle.entity';

// Simulacre d'utilisateur connecté (ce que JwtStrategy injecte dans req.user —
// même contrat que `team.controller.spec.ts`/`VehicleController`).
const mockUser = { id: 42, email: 'test@test.com' };
const mockRequest = { user: mockUser };

// Véhicule fictif retourné par le service mocké — seul `id` nous intéresse ici
// (le controller ne fait que relayer le résultat, il n'inspecte pas son contenu).
const mockVehicle: Partial<Vehicle> = { id: 7, nomInterne: 'camion' };

describe('WeaponController', () => {
  let controller: WeaponController;

  const mockWeaponService = {
    getAvailableWeapons: vi.fn(),
    addWeapon: vi.fn(),
    removeWeapon: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WeaponController],
      providers: [{ provide: WeaponService, useValue: mockWeaponService }],
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
    it('appelle WeaponService.addWeapon avec id, userId, nomInterne et orientation', async () => {
      mockWeaponService.addWeapon.mockResolvedValue(mockVehicle);
      const dto = { nomInterne: 'mitrailleuse', orientation: 'avant' as const };

      const result = await controller.addWeapon(7, mockRequest as never, dto);

      expect(mockWeaponService.addWeapon).toHaveBeenCalledWith(7, 42, 'mitrailleuse', 'avant');
      expect(result).toEqual(mockVehicle);
    });

    it('transmet `orientation: undefined` telle quelle pour une arme d\'équipage (le DTO ne préjuge de rien)', async () => {
      mockWeaponService.addWeapon.mockResolvedValue(mockVehicle);
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
