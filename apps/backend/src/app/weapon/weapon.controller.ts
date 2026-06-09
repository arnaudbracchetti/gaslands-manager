/**
 * WeaponController — points d'entrée HTTP du module Weapon.
 *
 * API REST répartie sur trois routes (cf. SPECIFICATION.md §6, "Armes") :
 *   GET    /api/vehicles/:id/available-weapons → catalogue filtré par sponsor, avec verdict
 *   POST   /api/vehicles/:id/weapons           → monter une arme sur un véhicule
 *   DELETE /api/weapons/:id                    → retirer une arme
 *
 * Note de conception — AUCUN préfixe de classe (`@Controller()` vide), chemins
 * COMPLETS déclarés méthode par méthode : exactement la même situation que celle
 * documentée dans `VehicleController` (routes "à plat" vs. "nichées" coexistant
 * dans une même ressource), à un degré supplémentaire — ici, les trois routes ne
 * partagent même pas de préfixe commun (`vehicles/:id/...` PUIS `weapons/:id`).
 * Un préfixe de classe forcerait soit à dupliquer `vehicles/:id` dans chaque
 * chemin de méthode (perdant tout l'intérêt du préfixe), soit à séparer ce
 * contrôleur en deux comme `vehicle-team.controller.ts`/`vehicle.controller.ts`
 * — séparation qui, ici, n'apporterait RIEN : les deux ressources concernées
 * (`Vehicle` pour lister/monter, `Weapon` pour retirer) sont déjà gérées par le
 * MÊME service (`WeaponService`), sans la moindre logique distincte à isoler.
 * Un contrôleur unique, sans préfixe, avec des chemins explicites par méthode,
 * documente fidèlement cette réalité plutôt que de la maquiller.
 *
 * Comme `VehicleController`, chaque endpoint est protégé par `@UseGuards(JwtAuthGuard)` —
 * `req.user.id` (injecté par `JwtStrategy`) est transmis au service, qui l'utilise
 * pour vérifier l'appartenance et lever `NotFoundException` (jamais `403`).
 */
import { Controller, Get, Post, Delete, Param, Body, Request, UseGuards, ParseIntPipe, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WeaponService } from './weapon.service';
import { VehicleService } from '../vehicle/vehicle.service';
import { AddWeaponDto } from './dto/add-weapon.dto';
import type { AvailableWeaponDto } from './dto/available-weapon.dto';
import type { VehicleDto } from '../vehicle/dto/vehicle.dto';

// Type du payload injecté par JwtStrategy dans req.user (cf. VehicleController — même contrat).
interface AuthenticatedRequest {
  user: { id: number; email: string };
}

@UseGuards(JwtAuthGuard)
@Controller()
export class WeaponController {
  constructor(
    private readonly weaponService: WeaponService,
    // Injecté pour appeler `toVehicleDto` après ajout d'une arme — `addWeapon`
    // retourne un `Vehicle` brut (entité hydratée) ; la transformation en DTO
    // enrichi (avec `prix`) appartient au contrôleur HTTP, pas au service métier.
    private readonly vehicleService: VehicleService,
  ) {}

  /**
   * GET /api/vehicles/:id/available-weapons
   *
   * Mirroir de `VehicleController.getAvailableImprovements` (cf. son en-tête) :
   * pour chaque arme du catalogue accessible au sponsor de l'équipe, calcule si
   * elle peut être montée sur CE véhicule, dans son état ACTUEL — et, si non,
   * pourquoi (cf. `WeaponService.getAvailableWeapons`).
   */
  @Get('vehicles/:id/available-weapons')
  getAvailableWeapons(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthenticatedRequest,
  ): Promise<AvailableWeaponDto[]> {
    return this.weaponService.getAvailableWeapons(id, req.user.id);
  }

  /**
   * POST /api/vehicles/:id/weapons
   *
   * Monte une arme — persistée SEULEMENT si la vérification à blanc (sponsor +
   * orientation + emplacements) est positive (cf. `WeaponService.addWeapon` :
   * "envelopper PUIS valider PUIS, et seulement alors, persister"). Retourne
   * le véhicule rechargé sous forme de `VehicleDto` enrichi (avec `prix` sur
   * chaque arme et amélioration).
   */
  @Post('vehicles/:id/weapons')
  async addWeapon(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthenticatedRequest,
    @Body() dto: AddWeaponDto,
  ): Promise<VehicleDto> {
    const vehicle = await this.weaponService.addWeapon(id, req.user.id, dto.nomInterne, dto.orientation);
    return this.vehicleService.toVehicleDto(vehicle);
  }

  /**
   * DELETE /api/weapons/:id
   *
   * Retire une arme d'un véhicule — sécurité via la chaîne `Weapon → Vehicle →
   * Team → User` (cf. `WeaponService.removeWeapon`, qui détaille pourquoi un
   * maillon de plus est nécessaire ici par rapport à `findOneForUser`).
   *
   * `@HttpCode(204)` : suppression réussie sans contenu à renvoyer — convention
   * REST standard pour un `DELETE` (`200` impliquerait un corps de réponse).
   */
  @Delete('weapons/:id')
  @HttpCode(204)
  removeWeapon(@Param('id', ParseIntPipe) id: number, @Request() req: AuthenticatedRequest): Promise<void> {
    return this.weaponService.removeWeapon(id, req.user.id);
  }
}
