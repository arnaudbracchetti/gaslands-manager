/**
 * Guard JWT — protège les routes qui nécessitent une authentification.
 *
 * Un guard NestJS est un intercepteur de requête : il décide si la requête
 * peut continuer vers le handler du controller ou doit être rejetée.
 *
 * AuthGuard('jwt') de @nestjs/passport :
 * - Déclenche automatiquement la JwtStrategy
 * - Retourne 401 Unauthorized si le token est absent, invalide ou expiré
 * - Si le token est valide, req.user est rempli par JwtStrategy.validate()
 *
 * Utilisation sur un endpoint :
 *   @UseGuards(JwtAuthGuard)
 *   @Get('me')
 *   getProfile(@Request() req) { return req.user; }
 */

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
