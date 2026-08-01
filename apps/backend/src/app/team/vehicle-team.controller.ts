/**
 * VehicleTeamController — routes `GET/POST /api/teams/:teamId/vehicles`.
 * Migré depuis vehicle/vehicle-team.controller.ts.
 */
import { Controller, Get, Post, Param, Body, Request, UseGuards, ParseIntPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { vehicleDomainToDto } from './infrastructure/team-http.mapper';
import { AddVehicleUseCase } from './application/add-vehicle.usecase';
import { GetAvailableVehiclesUseCase } from './application/get-available-vehicles.usecase';
import { TEAM_REPOSITORY } from './team.tokens';
import type { VehicleDto } from './dto/vehicle.dto';
import type { AvailableVehicleDto } from './dto/available-vehicle.dto';
import type { ITeamRepository } from './domain/team.repository.interface';
import { Inject } from '@nestjs/common';

interface AuthenticatedRequest {
  user: { id: number; email: string };
}

@UseGuards(JwtAuthGuard)
@Controller('teams/:teamId/vehicles')
export class VehicleTeamController {
  constructor(
    @Inject(TEAM_REPOSITORY) private readonly teamRepo: ITeamRepository,
    private readonly addVehicleUseCase: AddVehicleUseCase,
    private readonly getAvailableVehicles: GetAvailableVehiclesUseCase,
  ) {}

  @Get()
  async getAll(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Request() req: AuthenticatedRequest,
  ): Promise<VehicleDto[]> {
    const team = await this.teamRepo.findByIdForUser(teamId, req.user.id);
    return team.vehicles.map((v) => vehicleDomainToDto(v));
  }

  /**
   * GET /api/teams/:teamId/vehicles/available → catalogue de véhicules du sponsor,
   * chacun accompagné de son verdict de disponibilité budgétaire (`disponible`/`raison`).
   * Mirroir de `GET /api/vehicles/:id/available-weapons` (VehicleController), mais
   * porté par ce controller-ci : aucun véhicule n'existe encore avant cet achat.
   */
  @Get('available')
  getAvailable(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Request() req: AuthenticatedRequest,
  ): Promise<AvailableVehicleDto[]> {
    return this.getAvailableVehicles.execute({ teamId, userId: req.user.id });
  }

  @Post()
  async create(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateVehicleDto,
  ): Promise<VehicleDto> {
    const team = await this.addVehicleUseCase.execute({
      teamId,
      nomInterne: dto.nomInterne,
      userId: req.user.id,
    });
    // Le véhicule nouvellement ajouté est le dernier de la collection
    const newVehicle = team.vehicles[team.vehicles.length - 1];
    return vehicleDomainToDto(newVehicle);
  }
}
