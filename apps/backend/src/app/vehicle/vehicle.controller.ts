/**
 * VehicleController — points d'entrée HTTP du module Vehicle.
 *
 * API REST sur `/api/vehicles` :
 *   GET    /api/vehicles/:id                                     → détail "monté" (stats + récapitulatif)
 *   GET    /api/vehicles/:id/available-improvements              → catalogue filtré par sponsor, avec verdict
 *   POST   /api/vehicles/:id/improvements                        → ajouter une amélioration
 *   PATCH  /api/vehicles/:vehicleId/improvements/:improvId/weapon → assigner une arme à une Tourelle
 *   DELETE /api/vehicles/:vehicleId/improvements/:improvId/weapon → désassigner l'arme d'une Tourelle
 *   DELETE /api/vehicles/:id/improvements/:improvementId         → retirer une amélioration
 *   DELETE /api/vehicles/:id                                     → supprimer le véhicule
 */
import { Controller, Get, Post, Patch, Delete, Param, Body, Request, UseGuards, ParseIntPipe, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AddImprovementDto } from './dto/add-improvement.dto';
import { AssignWeaponToTourelleDto } from './dto/assign-weapon-to-tourelle.dto';
import { vehicleToDto } from './infrastructure/vehicle-http.mapper';
import { GetVehicleDetailUseCase } from './application/get-vehicle-detail.usecase';
import { GetAvailableImprovementsUseCase } from './application/get-available-improvements.usecase';
import { AddImprovementUseCase } from './application/add-improvement.usecase';
import { RemoveImprovementUseCase } from './application/remove-improvement.usecase';
import { AssignWeaponToTourelleUseCase } from './application/assign-weapon-to-tourelle.usecase';
import { UnassignWeaponFromTourelleUseCase } from './application/unassign-weapon-from-tourelle.usecase';
import { RemoveVehicleUseCase } from './application/remove-vehicle.usecase';
import type { AvailableImprovementDto } from './dto/available-improvement.dto';
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
    private readonly assignWeaponToTourelleUseCase: AssignWeaponToTourelleUseCase,
    private readonly unassignWeaponFromTourelleUseCase: UnassignWeaponFromTourelleUseCase,
    private readonly removeVehicleUseCase: RemoveVehicleUseCase,
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
    const vehicle = await this.addImprovementUseCase.execute({
      vehicleId: id,
      nomInterne: dto.nomInterne,
      orientation: dto.orientation ?? null,
      userId: req.user.id,
    });
    return vehicleToDto(vehicle);
  }

  @Patch(':vehicleId/improvements/:improvId/weapon')
  async assignWeapon(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Param('improvId', ParseIntPipe) improvId: number,
    @Request() req: AuthenticatedRequest,
    @Body() dto: AssignWeaponToTourelleDto,
  ): Promise<VehicleDto> {
    const vehicle = await this.assignWeaponToTourelleUseCase.execute({
      vehicleId,
      improvementId: improvId,
      weaponNomInterne: dto.weaponNomInterne,
      userId: req.user.id,
    });
    return vehicleToDto(vehicle);
  }

  @Delete(':vehicleId/improvements/:improvId/weapon')
  @HttpCode(200)
  async unassignWeapon(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Param('improvId', ParseIntPipe) improvId: number,
    @Request() req: AuthenticatedRequest,
  ): Promise<VehicleDto> {
    const vehicle = await this.unassignWeaponFromTourelleUseCase.execute({
      vehicleId,
      improvementId: improvId,
      userId: req.user.id,
    });
    return vehicleToDto(vehicle);
  }

  @Delete(':id/improvements/:improvementId')
  @HttpCode(204)
  removeImprovement(
    @Param('id', ParseIntPipe) id: number,
    @Param('improvementId', ParseIntPipe) improvementId: number,
    @Request() req: AuthenticatedRequest,
  ): Promise<void> {
    return this.removeImprovementUseCase.execute({ vehicleId: id, improvementId, userId: req.user.id }).then(() => undefined);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number, @Request() req: AuthenticatedRequest): Promise<void> {
    return this.removeVehicleUseCase.execute({ vehicleId: id, userId: req.user.id });
  }
}
