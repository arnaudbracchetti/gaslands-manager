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
import { JwtAuthGuard } from './jwt-auth.guard';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { SetActiveDto } from './dto/set-active.dto';
import { UserRole } from './user.entity';
import { type SafeUser, UserService } from './user.service';

interface AuthenticatedRequest {
  user: { id: number };
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly userService: UserService) {}

  /**
   * GET /api/users
   * Retourne tous les comptes enregistrés (sans le mot de passe).
   */
  @Get()
  findAll(): Promise<SafeUser[]> {
    return this.userService.findAll();
  }

  /**
   * DELETE /api/users/:id
   * Supprime un compte. UserService.remove interdit l'auto-suppression.
   */
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req: AuthenticatedRequest): Promise<void> {
    return this.userService.remove(id, req.user.id);
  }

  /**
   * PATCH /api/users/:id/active
   * Active ou désactive un compte. UserService.setActive interdit
   * de modifier son propre statut.
   */
  @Patch(':id/active')
  setActive(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthenticatedRequest,
    @Body() dto: SetActiveDto,
  ): Promise<SafeUser> {
    return this.userService.setActive(id, req.user.id, dto.isActive);
  }
}
