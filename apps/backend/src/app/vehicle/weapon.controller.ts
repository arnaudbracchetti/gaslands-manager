/**
 * WeaponController — points d'entrée HTTP pour les armes.
 *
 * Migré depuis weapon/ vers vehicle/ lors de la fusion des modules.
 *
 * API REST :
 *   GET    /api/vehicles/:id/available-weapons → catalogue filtré par sponsor, avec verdict
 *   POST   /api/vehicles/:id/weapons           → monter une arme sur un véhicule
 *   DELETE /api/weapons/:id                    → retirer une arme
 */
import { Controller, Get, Post, Delete, Param, Body, Request, UseGuards, ParseIntPipe, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AddWeaponDto } from '../weapon/dto/add-weapon.dto';
import { vehicleToDto } from './infrastructure/vehicle-http.mapper';
import { GetAvailableWeaponsUseCase } from './application/get-available-weapons.usecase';
import { AddWeaponUseCase } from './application/add-weapon.usecase';
import { RemoveWeaponUseCase } from './application/remove-weapon.usecase';
import type { AvailableWeaponDto } from '../weapon/dto/available-weapon.dto';
import type { VehicleDto } from './dto/vehicle.dto';

interface AuthenticatedRequest {
  user: { id: number; email: string };
}

@UseGuards(JwtAuthGuard)
@Controller()
export class WeaponController {
  constructor(
    private readonly getAvailableWeaponsUseCase: GetAvailableWeaponsUseCase,
    private readonly addWeaponUseCase: AddWeaponUseCase,
    private readonly removeWeaponUseCase: RemoveWeaponUseCase,
  ) {}

  @Get('vehicles/:id/available-weapons')
  getAvailableWeapons(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthenticatedRequest,
  ): Promise<AvailableWeaponDto[]> {
    return this.getAvailableWeaponsUseCase.execute({ vehicleId: id, userId: req.user.id });
  }

  @Post('vehicles/:id/weapons')
  async addWeapon(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthenticatedRequest,
    @Body() dto: AddWeaponDto,
  ): Promise<VehicleDto> {
    const vehicle = await this.addWeaponUseCase.execute({
      vehicleId: id,
      nomInterne: dto.nomInterne,
      orientation: dto.orientation ?? null,
      userId: req.user.id,
    });
    return vehicleToDto(vehicle);
  }

  @Delete('weapons/:id')
  @HttpCode(204)
  async removeWeapon(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthenticatedRequest,
  ): Promise<void> {
    // weaponId seul — le use case charge le véhicule propriétaire via findByWeaponId
    await this.removeWeaponUseCase.execute({ weaponId: id, userId: req.user.id });
  }
}
