/**
 * VehicleController — points d'entrée HTTP du module Vehicle.
 *
 * API REST sur `/api/vehicles` :
 *   GET    /api/vehicles/:id                              → détail "monté" (stats + récapitulatif)
 *   GET    /api/vehicles/:id/available-improvements       → catalogue filtré par sponsor, avec verdict
 *   POST   /api/vehicles/:id/improvements                 → ajouter une amélioration
 *   DELETE /api/vehicles/:id/improvements/:improvementId  → retirer une amélioration
 *   DELETE /api/vehicles/:id                              → supprimer le véhicule
 *
 * `PUT /api/vehicles/:id` n'existe pas : `Vehicle` n'a aucun champ modifiable une fois créé.
 * `nomInterne` est la clé catalogue immuable — la changer invaliderait tout l'équipement déjà
 * posé. "Modifier un véhicule" signifie gérer son équipement, couvert par les routes
 * `POST`/`DELETE …/improvements` et `POST`/`DELETE …/weapons`.
 *
 * Routes "à plat" (`/api/vehicles/:id`) plutôt que nichées sous `/teams/:id` : toutes les
 * opérations sur un véhicule précis s'adressent à une ressource identifiable par son propre id.
 * La sécurité repose sur `Vehicle → Team → User` — un `:teamId` de route serait un paramètre
 * mort, jamais vérifié. Seules liste et création (`GET/POST /api/teams/:teamId/vehicles`) ont
 * besoin du contexte d'équipe — elles vivent dans `VehicleTeamController`.
 *
 * Chaque endpoint est protégé par `@UseGuards(JwtAuthGuard)` ; `req.user.id` est transmis au
 * service, qui lève `NotFoundException` (jamais `403`) si l'appartenance échoue.
 */
import { Controller, Get, Post, Delete, Param, Body, Request, UseGuards, ParseIntPipe, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VehicleService } from './vehicle.service';
import { AddImprovementDto } from './dto/add-improvement.dto';
import type { AvailableImprovementDto } from './dto/available-improvement.dto';
import type { VehicleDetailDto } from './dto/vehicle-detail.dto';
import type { VehicleDto } from './dto/vehicle.dto';

// Type du payload injecté par JwtStrategy dans req.user (cf. TeamController — même contrat).
interface AuthenticatedRequest {
  user: { id: number; email: string };
}

@UseGuards(JwtAuthGuard)
@Controller('vehicles')
export class VehicleController {
  constructor(private readonly vehicleService: VehicleService) {}

  /**
   * GET /api/vehicles/:id
   *
   * Reconstitue la chaîne `VehicleBuild` du véhicule (cf. `VehicleService.getBuild`)
   * et n'en expose QUE le résultat calculé — jamais la chaîne elle-même : le client
   * HTTP n'a pas à connaître le Pattern Decorator (cf. `VehicleDetailDto`).
   */
  @Get(':id')
  async getOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthenticatedRequest,
  ): Promise<VehicleDetailDto> {
    const vehicle = await this.vehicleService.findOneForUser(id, req.user.id);
    const build = this.vehicleService.getBuild(vehicle);

    return {
      id: vehicle.id,
      nomInterne: vehicle.nomInterne,
      stats: build.stats,
      baseStats: build.baseStats,
      recapitulatif: build.describe(),
    };
  }
  /**
   * GET /api/vehicles/:id/available-improvements
   *
   * Pour chaque amélioration du catalogue accessible au sponsor de l'équipe,
   * calcule si elle peut être ajoutée à CE véhicule, dans son état ACTUEL — et,
   * si non, pourquoi (cf. `VehicleService.getAvailableImprovements`, qui documente
   * la nuance "interdit" vs. "renseignement manquant", ex: orientation du Bélier).
   *
   * Route déclarée juste après `:id` : Nest la distingue sans ambiguïté grâce à
   * son second segment littéral, peu importe l'ordre — mais pour la LISIBILITÉ,
   * autant placer la route spécifique immédiatement après la route générale
   * qu'elle prolonge, plutôt que dispersées dans le fichier.
   */
  @Get(':id/available-improvements')
  getAvailableImprovements(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthenticatedRequest,
  ): Promise<AvailableImprovementDto[]> {
    return this.vehicleService.getAvailableImprovements(id, req.user.id);
  }

  /**
   * POST /api/vehicles/:id/improvements
   *
   * Ajoute une amélioration — persistée SEULEMENT si la chaîne hypothétique
   * (véhicule + candidat) est valide (cf. `VehicleService.addImprovement` :
   * "envelopper PUIS valider PUIS, et seulement alors, persister").
   * Retourne le véhicule rechargé sous forme de `VehicleDto` enrichi.
   */
  @Post(':id/improvements')
  async addImprovement(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthenticatedRequest,
    @Body() dto: AddImprovementDto,
  ): Promise<VehicleDto> {
    const vehicle = await this.vehicleService.addImprovement(id, req.user.id, dto.nomInterne, {
      orientation: dto.orientation,
    });
    return this.vehicleService.toVehicleDto(vehicle);
  }

  /**
   * DELETE /api/vehicles/:id/improvements/:improvementId
   *
   * Retire une amélioration posée sur ce véhicule. `VehicleImprovement` n'a pas de
   * service propre — cette opération unique vit directement ici et réutilise la relation
   * `improvements` déjà chargée par `findOneForUser` (cf. `VehicleService.removeImprovement`).
   *
   * Aucune vérification de règle métier avant retrait : retirer est toujours permis,
   * seul l'AJOUT est soumis à validation. `@HttpCode(204)` : convention REST standard.
   */
  @Delete(':id/improvements/:improvementId')
  @HttpCode(204)
  removeImprovement(
    @Param('id', ParseIntPipe) id: number,
    @Param('improvementId', ParseIntPipe) improvementId: number,
    @Request() req: AuthenticatedRequest,
  ): Promise<void> {
    return this.vehicleService.removeImprovement(id, improvementId, req.user.id);
  }

  /**
   * DELETE /api/vehicles/:id
   *
   * Supprime le véhicule et — par cascade TypeORM (`onDelete: 'CASCADE'`, cf.
   * `vehicle.entity.ts`) — tout son équipement en une seule opération SQL.
   * `@HttpCode(204)` : convention REST standard.
   */
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number, @Request() req: AuthenticatedRequest): Promise<void> {
    return this.vehicleService.remove(id, req.user.id);
  }
}
