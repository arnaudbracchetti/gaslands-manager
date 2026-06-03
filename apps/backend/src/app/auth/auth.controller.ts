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
// import type : AuthResponse et SafeUser sont des constructions purement TypeScript
// (interface / type alias) — elles n'existent pas à l'exécution.
// Avec emitDecoratorMetadata + isolatedModules (config NestJS), TypeScript exige
// `import type` pour les types utilisés dans des signatures décorées,
// afin d'éviter d'émettre des métadonnées invalides pour des symboles inexistants.
import { type AuthResponse, AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { SafeUser } from './user.service';

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
  // Promise<AuthResponse> : ce handler est async (délégation à authService.register()).
  // Le type de retour documente le contrat HTTP : { access_token, user } sans password.
  register(@Body() dto: RegisterDto): Promise<AuthResponse> {
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
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
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
  // req.user est typé SafeUser (et non unknown) car JwtStrategy.validate()
  // retourne Promise<SafeUser | null> — Passport place cette valeur dans req.user.
  getProfile(@Request() req: { user: SafeUser }): SafeUser {
    return req.user;
  }
}
