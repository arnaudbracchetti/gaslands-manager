/**
 * Guard de route d'authentification.
 *
 * Un guard Angular décide si une navigation vers une route peut avoir lieu.
 * Il est exécuté avant le chargement du composant.
 *
 * CanActivateFn : type fonctionnel (Angular 15+) — plus simple qu'une classe,
 * compatible standalone, pas besoin de l'enregistrer dans un module.
 *
 * Logique :
 * - Utilisateur connecté (isLoggedIn() === true) → autoriser la navigation
 * - Utilisateur non connecté → rediriger vers /login
 *
 * La redirection via createUrlTree(['/login']) est préférable à router.navigate()
 * car elle permet à Angular d'annuler proprement la navigation initiale.
 *
 * Utilisation dans app.routes.ts :
 *   { path: 'teams', loadComponent: ..., canActivate: [authGuard] }
 */

import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Attend la fin de la restauration de session (GET /api/auth/me) avant de
  // statuer — sinon, sur un rechargement de page, isLoggedIn() vaudrait
  // encore `false` (currentUser pas encore peuplé) et redirigerait vers
  // /login même pour un utilisateur connecté (cf. AuthService.whenSessionReady).
  await firstValueFrom(authService.whenSessionReady());

  if (authService.isLoggedIn()) {
    return true; // Navigation autorisée
  }

  // createUrlTree(['/login']) : retourne un UrlTree qui redirige vers /login
  // Angular l'interprète comme "annuler la navigation et aller à /login"
  return router.createUrlTree(['/login']);
};
