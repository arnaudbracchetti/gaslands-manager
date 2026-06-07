/**
 * VehicleController — points d'entrée HTTP du module Vehicle.
 *
 * API REST sur `/api/vehicles` :
 *   GET  /api/vehicles/:id                       → détail "monté" (stats + récapitulatif)
 *   GET  /api/vehicles/:id/available-improvements → catalogue filtré par sponsor, avec verdict
 *   POST /api/vehicles/:id/improvements           → ajouter une amélioration
 *
 * Note de conception — routes "à plat" `/api/vehicles/:id`, jamais nichées sous
 * `/teams/:id` : le plan d'architecture esquissait `GET /api/teams/:id/vehicles/:vehicleId`
 * pour la consultation, mais `POST /api/vehicles/:id/improvements` (sans `:teamId`) pour
 * la modification — un nichage incohérent entre les deux. En reconsultant SPECIFICATION.md
 * §6, j'ai retenu la convention qui s'harmonise avec les routes DÉJÀ PRÉVUES pour un
 * véhicule précis (`PUT /api/vehicles/:id`, `DELETE /api/vehicles/:id` — toutes "à plat").
 * C'est aussi la convention cohérente avec la sécurité RÉELLE : `VehicleService.findOneForUser`
 * vérifie l'appartenance via la chaîne `Vehicle → Team → User` (sur `userId`), jamais via
 * un `teamId` de route — qui resterait un paramètre mort, jamais consulté ni vérifié. Seules
 * les routes de LISTE/CRÉATION (`GET/POST /api/teams/:id/vehicles`, hors périmètre de cette
 * étape — cf. backlog SPECIFICATION.md §4.1) ont réellement besoin du contexte d'équipe
 * dans l'URL, puisqu'il n'existe alors encore aucun véhicule à identifier par son propre id.
 *
 * Comme `TeamController`, chaque endpoint est protégé par `@UseGuards(JwtAuthGuard)` —
 * `req.user.id` (injecté par `JwtStrategy`) est transmis au service, qui l'utilise pour
 * vérifier l'appartenance et lever `NotFoundException` (jamais `403`) en cas de refus.
 */
import { Controller, Get, Post, Param, Body, Request, UseGuards, ParseIntPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VehicleService } from './vehicle.service';
import { Vehicle } from './vehicle.entity';
import { AddImprovementDto } from './dto/add-improvement.dto';
import type { AvailableImprovementDto } from './dto/available-improvement.dto';
import type { VehicleDetailDto } from './dto/vehicle-detail.dto';

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
   * Retourne le véhicule rechargé, amélioration nouvellement incluse.
   */
  @Post(':id/improvements')
  addImprovement(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthenticatedRequest,
    @Body() dto: AddImprovementDto,
  ): Promise<Vehicle> {
    return this.vehicleService.addImprovement(id, req.user.id, dto.nomInterne, {
      orientation: dto.orientation,
    });
  }
}
