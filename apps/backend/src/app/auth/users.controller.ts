/**
 * UsersController — endpoints d'administration des comptes utilisateurs.
 *
 * Réservé aux administrateurs : @UseGuards(JwtAuthGuard, RolesGuard) +
 * @Roles(UserRole.ADMIN) — l'ordre des guards est important, JwtAuthGuard
 * doit peupler req.user AVANT que RolesGuard lise req.user.role.
 *
 * Routes :
 *   GET   /api/users            → liste tous les comptes
 *   DELETE /api/users/:id       → supprime un compte (cascade équipes/véhicules)
 *   PATCH /api/users/:id/active → active/désactive un compte
 */
import { Body, Controller, Delete, Get, Param, Patch, Request, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ListUsersUseCase } from './application/list-users.usecase';
import { RemoveUserUseCase } from './application/remove-user.usecase';
import { SetActiveUseCase } from './application/set-active.usecase';
import { UserRole } from './domain/user-role';
import { SetActiveDto } from './dto/set-active.dto';
import type { UserResponseDto } from './dto/user-response.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

interface AuthenticatedRequest {
  user: { id: number };
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('users')
export class UsersController {
  constructor(
    private readonly listUsersUseCase: ListUsersUseCase,
    private readonly removeUserUseCase: RemoveUserUseCase,
    private readonly setActiveUseCase: SetActiveUseCase,
  ) {}

  /**
   * GET /api/users
   * Retourne tous les comptes enregistrés (sans le mot de passe).
   */
  @Get()
  findAll(): Promise<UserResponseDto[]> {
    return this.listUsersUseCase.execute();
  }

  /**
   * DELETE /api/users/:id
   * Supprime un compte. L'agrégat interdit l'auto-suppression (403).
   */
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req: AuthenticatedRequest): Promise<void> {
    return this.removeUserUseCase.execute({ userId: id, requesterId: req.user.id });
  }

  /**
   * PATCH /api/users/:id/active
   * Active ou désactive un compte. L'agrégat interdit de modifier son propre
   * statut (403).
   */
  @Patch(':id/active')
  setActive(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthenticatedRequest,
    @Body() dto: SetActiveDto,
  ): Promise<UserResponseDto> {
    return this.setActiveUseCase.execute({ userId: id, requesterId: req.user.id, isActive: dto.isActive });
  }
}
