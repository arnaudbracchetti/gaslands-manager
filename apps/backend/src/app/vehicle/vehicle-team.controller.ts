/**
 * VehicleTeamController — points d'entrée HTTP "nichés" sous une équipe.
 *
 * API REST sur `/api/teams/:teamId/vehicles` :
 *   GET  /api/teams/:teamId/vehicles  → liste des véhicules de l'équipe
 *   POST /api/teams/:teamId/vehicles  → ajouter un véhicule à l'équipe
 *
 * Pourquoi un second controller plutôt qu'ajouter ces routes à `VehicleController` ?
 * NestJS n'autorise qu'UN SEUL préfixe `@Controller(...)` par classe — `vehicles`
 * pour l'un, `teams/:teamId/vehicles` pour l'autre. Les deux délèguent au MÊME
 * `VehicleService` : la séparation est purement une question de forme des routes HTTP,
 * pas de logique métier (cf. `VehicleController` pour le détail).
 */
import { Controller, Get, Post, Param, Body, Request, UseGuards, ParseIntPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VehicleService } from './vehicle.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import type { VehicleDto } from './dto/vehicle.dto';

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
   * Retourne des `VehicleDto` (avec `prix` et `estDefaut` sur chaque
   * amélioration/arme) plutôt que des entités brutes.
   */
  @Get()
  async getAll(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Request() req: AuthenticatedRequest,
  ): Promise<VehicleDto[]> {
    const vehicles = await this.vehicleService.findAllForTeam(teamId, req.user.id);
    return vehicles.map((v) => this.vehicleService.toVehicleDto(v));
  }

  /**
   * POST /api/teams/:teamId/vehicles
   *
   * Crée un véhicule "nu" (sans arme ni amélioration achetée, mais avec les
   * améliorations par défaut du type s'il en a) dans l'équipe. Retourne le
   * véhicule créé sous forme de `VehicleDto` enrichi.
   */
  @Post()
  async create(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateVehicleDto,
  ): Promise<VehicleDto> {
    const vehicle = await this.vehicleService.create(teamId, req.user.id, dto.nomInterne);
    return this.vehicleService.toVehicleDto(vehicle);
  }
}
