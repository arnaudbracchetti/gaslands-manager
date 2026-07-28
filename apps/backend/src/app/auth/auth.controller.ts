/**
 * AuthController — expose les endpoints REST d'authentification.
 *
 * Préfixe de module : 'auth' + préfixe global '/api' → tous les endpoints
 * commencent par /api/auth/...
 *
 * Routes :
 *   POST  /api/auth/register    → inscription
 *   POST  /api/auth/login       → connexion
 *   GET   /api/auth/me          → profil de l'utilisateur connecté (protégé)
 *   PATCH /api/auth/me          → auto-édition du profil (protégé)
 *   PATCH /api/auth/me/password → changement de mot de passe (protégé)
 *
 * Le rôle du contrôleur est UNIQUEMENT de traduire HTTP → commande, déléguer au
 * use case et renvoyer la réponse. Pas de logique métier ici.
 */

import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { ChangePasswordUseCase } from './application/change-password.usecase';
import { LoginUseCase } from './application/login.usecase';
import { RegisterUseCase } from './application/register.usecase';
import { UpdateProfileUseCase } from './application/update-profile.usecase';
import type { User } from './domain/user';
import type { AuthResponseDto } from './dto/auth-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { UserResponseDto } from './dto/user-response.dto';
import { userDomainToDto } from './infrastructure/user-http.mapper';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * `req.user` est l'agrégat `User` lui-même, déposé par `JwtStrategy.validate()`
 * — d'où l'accès direct à `req.user.callName` depuis n'importe quel controller.
 */
interface AuthenticatedRequest {
  user: User;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly updateProfileUseCase: UpdateProfileUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
  ) {}

  /**
   * POST /api/auth/register
   * Corps attendu : { firstName, lastName, pseudo, email, password }
   * Retourne : { access_token: string, user: UserResponseDto }
   * Codes HTTP : 201 Created, 409 Conflict (email déjà pris), 400 (données invalides)
   */
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.registerUseCase.execute(dto);
  }

  /**
   * POST /api/auth/login
   * Corps attendu : { email, password }
   * Codes HTTP : 200 OK, 401 Unauthorized (identifiants invalides / compte désactivé)
   */
  @Post('login')
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.loginUseCase.execute(dto);
  }

  /**
   * GET /api/auth/me
   * Requiert un header : Authorization: Bearer <jwt_token>
   *
   * `req.user` est un agrégat de domaine : il DOIT passer par le mapper —
   * `JSON.stringify` ne sérialiserait pas son getter `callName`.
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Request() req: AuthenticatedRequest): UserResponseDto {
    return userDomainToDto(req.user);
  }

  /**
   * PATCH /api/auth/me
   * Corps attendu : { firstName, lastName, pseudo, email }
   * Codes HTTP : 200 OK, 400 (champ manquant), 409 (email déjà pris), 401
   */
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateProfile(
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    return this.updateProfileUseCase.execute({ ...dto, userId: req.user.id });
  }

  /**
   * PATCH /api/auth/me/password
   * Corps attendu : { currentPassword, newPassword }
   * Retourne : rien (204 No Content)
   * Codes HTTP : 400 (mot de passe actuel incorrect / nouveau trop court), 401
   */
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch('me/password')
  changePassword(
    @Request() req: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.changePasswordUseCase.execute({ ...dto, userId: req.user.id });
  }
}
