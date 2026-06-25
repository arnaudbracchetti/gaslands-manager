/**
 * VehicleTeamController — points d'entrée HTTP "nichés" sous une équipe.
 *
 * API REST sur `/api/teams/:teamId/vehicles` :
 *   GET  /api/teams/:teamId/vehicles  → liste des véhicules de l'équipe
 *   POST /api/teams/:teamId/vehicles  → ajouter un véhicule à l'équipe
 */
import { Controller, Get, Post, Param, Body, Request, UseGuards, ParseIntPipe, Inject } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TeamService } from '../team/team.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { vehicleToDto } from './infrastructure/vehicle-http.mapper';
import { VEHICLE_REPOSITORY } from './vehicle.tokens';
import { CreateVehicleUseCase } from './application/create-vehicle.usecase';
import type { VehicleDto } from './dto/vehicle.dto';
import type { IVehicleRepository } from './domain/vehicle.repository.interface';

interface AuthenticatedRequest {
  user: { id: number; email: string };
}

@UseGuards(JwtAuthGuard)
@Controller('teams/:teamId/vehicles')
export class VehicleTeamController {
  constructor(
    @Inject(VEHICLE_REPOSITORY) private readonly vehicleRepo: IVehicleRepository,
    private readonly teamService: TeamService,
    private readonly createVehicleUseCase: CreateVehicleUseCase,
  ) {}

  @Get()
  async getAll(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Request() req: AuthenticatedRequest,
  ): Promise<VehicleDto[]> {
    const vehicles = await this.vehicleRepo.findAllForTeam(teamId, req.user.id);
    return vehicles.map(vehicleToDto);
  }

  @Post()
  async create(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateVehicleDto,
  ): Promise<VehicleDto> {
    // Le sponsor est porté par l'équipe — on le résout avant de passer au use case
    const team = await this.teamService.findOneForUser(teamId, req.user.id);
    const vehicle = await this.createVehicleUseCase.execute({
      teamId,
      sponsorNom: team.sponsor,
      nomInterne: dto.nomInterne,
      userId: req.user.id,
    });
    return vehicleToDto(vehicle);
  }
}
