/**
 * WeaponController — routes `/api/vehicles/:id/available-weapons`,
 * `POST /api/vehicles/:id/weapons`, `DELETE /api/weapons/:id`.
 * Migré depuis vehicle/weapon.controller.ts.
 */
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Request,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AddWeaponDto } from './dto/add-weapon.dto';
import { vehicleDomainToDto } from './infrastructure/team-http.mapper';
import { GetAvailableWeaponsUseCase } from './application/get-available-weapons.usecase';
import { AddWeaponUseCase } from './application/add-weapon.usecase';
import { RemoveWeaponUseCase } from './application/remove-weapon.usecase';
import type { AvailableWeaponDto } from './dto/available-weapon.dto';
import type { VehicleDto } from './dto/vehicle.dto';

interface AuthenticatedRequest {
  user: { id: number; email: string };
}

@UseGuards(JwtAuthGuard)
@Controller()
export class WeaponController {
  constructor(
    private readonly getAvailableWeapons: GetAvailableWeaponsUseCase,
    private readonly addWeaponUseCase: AddWeaponUseCase,
    private readonly removeWeaponUseCase: RemoveWeaponUseCase,
  ) {}

  @Get('vehicles/:id/available-weapons')
  getAvailableWeaponsList(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthenticatedRequest,
  ): Promise<AvailableWeaponDto[]> {
    return this.getAvailableWeapons.execute({ vehicleId: id, userId: req.user.id });
  }

  @Post('vehicles/:id/weapons')
  async addWeapon(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthenticatedRequest,
    @Body() dto: AddWeaponDto,
  ): Promise<VehicleDto> {
    const team = await this.addWeaponUseCase.execute({
      vehicleId: id,
      nomInterne: dto.nomInterne,
      orientation: dto.orientation ?? null,
      userId: req.user.id,
    });
    const vehicle = team.findVehicle(id);
    return vehicleDomainToDto(vehicle);
  }

  @Delete('weapons/:id')
  async removeWeapon(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthenticatedRequest,
  ): Promise<VehicleDto> {
    const vehicle = await this.removeWeaponUseCase.execute({ weaponId: id, userId: req.user.id });
    return vehicleDomainToDto(vehicle);
  }
}
