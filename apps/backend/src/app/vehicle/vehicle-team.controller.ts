/**
 * VehicleTeamController — points d'entrée HTTP "nichés" sous une équipe.
 *
 * API REST sur `/api/teams/:teamId/vehicles` :
 *   GET  /api/teams/:teamId/vehicles  → liste des véhicules de l'équipe
 *   POST /api/teams/:teamId/vehicles  → ajouter un véhicule à l'équipe
 *
 * Pourquoi un second controller plutôt qu'ajouter ces routes à `VehicleController` ?
 * NestJS n'autorise qu'UN SEUL préfixe `@Controller(...)` par classe — `vehicles`
 * pour l'un, `teams/:teamId/vehicles` pour l'autre, ce sont deux arborescences
 * d'URL distinctes. Les deux délèguent malgré tout au MÊME `VehicleService` :
 * la séparation est purement une question de FORME des routes HTTP, pas de
 * logique métier (cf. l'en-tête de `VehicleController`, qui détaille pourquoi
 * CES DEUX routes — et seulement elles — ont besoin du contexte d'équipe dans
 * l'URL : il n'existe encore aucun véhicule à identifier par son propre id).
 *
 * Comme `VehicleController`/`TeamController`, chaque route est protégée par
 * `@UseGuards(JwtAuthGuard)` ; `req.user.id` est transmis au service, qui
 * l'utilise pour vérifier — via `TeamService.findOneForUser` — que l'équipe
 * `:teamId` appartient bien à l'utilisateur connecté (sinon `NotFoundException`,
 * jamais `403` : même logique de non-divulgation que partout ailleurs).
 */
import { Controller, Get, Post, Param, Body, Request, UseGuards, ParseIntPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VehicleService } from './vehicle.service';
import { Vehicle } from './vehicle.entity';
import { CreateVehicleDto } from './dto/create-vehicle.dto';

// Type du payload injecté par JwtStrategy dans req.user (cf. VehicleController — même contrat).
interface AuthenticatedRequest {
  user: { id: number; email: string };
}

@UseGuards(JwtAuthGuard)
@Controller('teams/:teamId/vehicles')
export class VehicleTeamController {
  constructor(private readonly vehicleService: VehicleService) {}

  /**
   * GET /api/teams/:teamId/vehicles
   *
   * Liste les véhicules de l'équipe — utilisé par le frontend pour rafraîchir
   * son état après une création (cf. `VehicleService.findAllForTeam`).
   */
  @Get()
  getAll(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Request() req: AuthenticatedRequest,
  ): Promise<Vehicle[]> {
    return this.vehicleService.findAllForTeam(teamId, req.user.id);
  }

  /**
   * POST /api/teams/:teamId/vehicles
   *
   * Crée un véhicule "nu" (sans arme ni amélioration) dans l'équipe — première
   * étape du flux de configuration ("choisir le véhicule" avant de l'équiper).
   * `VehicleService.create` vérifie que `nomInterne` fait bien partie des
   * véhicules autorisés par le sponsor de l'équipe avant de persister.
   */
  @Post()
  create(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateVehicleDto,
  ): Promise<Vehicle> {
    return this.vehicleService.create(teamId, req.user.id, dto.nomInterne);
  }
}
