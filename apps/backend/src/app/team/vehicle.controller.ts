/**
 * VehicleController — routes `/api/vehicles/:id`.
 * Migré depuis vehicle/vehicle.controller.ts.
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Request,
  UseGuards,
  ParseIntPipe,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AddImprovementDto } from './dto/add-improvement.dto';
import { AddAdvantageDto } from './dto/add-advantage.dto';
import { RenameVehicleDto } from './dto/rename-vehicle.dto';
import { vehicleDomainToDto } from './infrastructure/team-http.mapper';
import { GetVehicleDetailUseCase } from './application/get-vehicle-detail.usecase';
import { GetAvailableImprovementsUseCase } from './application/get-available-improvements.usecase';
import { AddImprovementUseCase } from './application/add-improvement.usecase';
import { RemoveImprovementUseCase } from './application/remove-improvement.usecase';
import { GetAvailableAdvantagesUseCase } from './application/get-available-advantages.usecase';
import { AddAdvantageUseCase } from './application/add-advantage.usecase';
import { RemoveAdvantageUseCase } from './application/remove-advantage.usecase';
import { RemoveVehicleUseCase } from './application/remove-vehicle.usecase';
import { RenameVehicleUseCase } from './application/rename-vehicle.usecase';
import type { AvailableImprovementDto } from './dto/available-improvement.dto';
import type { AvailableAdvantageDto } from './dto/available-advantage.dto';
import type { VehicleDetailDto } from './dto/vehicle-detail.dto';
import type { VehicleDto } from './dto/vehicle.dto';

interface AuthenticatedRequest {
  user: { id: number; email: string };
}

@UseGuards(JwtAuthGuard)
@Controller('vehicles')
export class VehicleController {
  constructor(
    private readonly getVehicleDetail: GetVehicleDetailUseCase,
    private readonly getAvailableImprovements: GetAvailableImprovementsUseCase,
    private readonly addImprovementUseCase: AddImprovementUseCase,
    private readonly removeImprovementUseCase: RemoveImprovementUseCase,
    private readonly getAvailableAdvantages: GetAvailableAdvantagesUseCase,
    private readonly addAdvantageUseCase: AddAdvantageUseCase,
    private readonly removeAdvantageUseCase: RemoveAdvantageUseCase,
    private readonly removeVehicleUseCase: RemoveVehicleUseCase,
    private readonly renameVehicleUseCase: RenameVehicleUseCase,
  ) {}

  @Get(':id')
  getOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthenticatedRequest,
  ): Promise<VehicleDetailDto> {
    return this.getVehicleDetail.execute({ vehicleId: id, userId: req.user.id });
  }

  @Get(':id/available-improvements')
  getAvailableImprovementsList(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthenticatedRequest,
  ): Promise<AvailableImprovementDto[]> {
    return this.getAvailableImprovements.execute({ vehicleId: id, userId: req.user.id });
  }

  @Post(':id/improvements')
  async addImprovement(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthenticatedRequest,
    @Body() dto: AddImprovementDto,
  ): Promise<VehicleDto> {
    const team = await this.addImprovementUseCase.execute({
      vehicleId: id,
      nomInterne: dto.nomInterne,
      orientation: dto.orientation ?? null,
      userId: req.user.id,
    });
    const vehicle = team.findVehicle(id);
    return vehicleDomainToDto(vehicle);
  }

  @Delete(':id/improvements/:improvementId')
  async removeImprovement(
    @Param('id', ParseIntPipe) id: number,
    @Param('improvementId', ParseIntPipe) improvementId: number,
    @Request() req: AuthenticatedRequest,
  ): Promise<VehicleDto> {
    const vehicle = await this.removeImprovementUseCase.execute({ vehicleId: id, improvementId, userId: req.user.id });
    return vehicleDomainToDto(vehicle);
  }

  @Get(':id/available-advantages')
  getAvailableAdvantagesList(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthenticatedRequest,
  ): Promise<AvailableAdvantageDto[]> {
    return this.getAvailableAdvantages.execute({ vehicleId: id, userId: req.user.id });
  }

  @Post(':id/advantages')
  async addAdvantage(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthenticatedRequest,
    @Body() dto: AddAdvantageDto,
  ): Promise<VehicleDto> {
    const team = await this.addAdvantageUseCase.execute({
      vehicleId: id,
      nomInterne: dto.nomInterne,
      userId: req.user.id,
    });
    const vehicle = team.findVehicle(id);
    return vehicleDomainToDto(vehicle);
  }

  @Delete(':id/advantages/:advantageId')
  async removeAdvantage(
    @Param('id', ParseIntPipe) id: number,
    @Param('advantageId', ParseIntPipe) advantageId: number,
    @Request() req: AuthenticatedRequest,
  ): Promise<VehicleDto> {
    const vehicle = await this.removeAdvantageUseCase.execute({ vehicleId: id, advantageId, userId: req.user.id });
    return vehicleDomainToDto(vehicle);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseIntPipe) id: number, @Request() req: AuthenticatedRequest): Promise<void> {
    await this.removeVehicleUseCase.execute({ vehicleId: id, userId: req.user.id });
  }

  @Patch(':id/name')
  async rename(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthenticatedRequest,
    @Body() dto: RenameVehicleDto,
  ): Promise<VehicleDto> {
    const team = await this.renameVehicleUseCase.execute({ vehicleId: id, nom: dto.nom, userId: req.user.id });
    return vehicleDomainToDto(team.findVehicle(id));
  }
}
