/**
 * AuthController — expose les endpoints REST d'authentification.
 *
 * Préfixe de module : 'auth' + préfixe global '/api' → tous les endpoints
 * commencent par /api/auth/...
 *
 * Routes :
 *   POST /api/auth/register  → inscription
 *   POST /api/auth/login     → connexion
 *   GET  /api/auth/me        → profil de l'utilisateur connecté (protégé)
 *
 * Le rôle du contrôleur est UNIQUEMENT de recevoir la requête HTTP,
 * déléguer la logique au service, et renvoyer la réponse.
 * Pas de logique métier ici.
 */

import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/auth/register
   * Corps attendu : { firstName, lastName, email, password }
   * Retourne : { access_token: string, user: SafeUser }
   * Codes HTTP : 201 Created (succès), 409 Conflict (email déjà pris), 401 (données invalides)
   */
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * POST /api/auth/login
   * Corps attendu : { email, password }
   * Retourne : { access_token: string, user: SafeUser }
   * Codes HTTP : 200 OK (succès), 401 Unauthorized (identifiants invalides)
   *
   * Note : NestJS retourne 200 pour @Post() par défaut.
   * Pour changer en 201, on utiliserait @HttpCode(HttpStatus.OK).
   */
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * GET /api/auth/me
   * Requiert un header : Authorization: Bearer <jwt_token>
   * Retourne : SafeUser (profil de l'utilisateur connecté)
   *
   * @UseGuards(JwtAuthGuard) : déclenche la validation JWT.
   * Si le token est valide, req.user est rempli par JwtStrategy.validate().
   * Si le token est absent/invalide/expiré, NestJS retourne 401 automatiquement.
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Request() req: { user: unknown }) {
    // req.user = valeur retournée par JwtStrategy.validate()
    // = SafeUser (sans password)
    return req.user;
  }
}
