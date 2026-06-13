/**
 * Guard de route admin.
 *
 * Même principe que authGuard, mais vérifie en plus que l'utilisateur
 * connecté a le rôle 'admin'. Protège les routes réservées à
 * l'administration (ex: /admin/users).
 *
 * Logique :
 * - Utilisateur connecté ET role === 'admin' → autoriser la navigation
 * - Sinon → rediriger vers /home (authGuard gère déjà le cas "non connecté"
 *   en redirigeant vers /login ; ici on suppose authGuard appliqué en amont
 *   dans la même route, donc currentUser() est déjà peuplé si connecté)
 *
 * Utilisation dans app.routes.ts :
 *   { path: 'admin/users', loadComponent: ..., canActivate: [authGuard, adminGuard] }
 */

import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.currentUser()?.role === 'admin') {
    return true; // Navigation autorisée
  }

  // createUrlTree(['/home']) : retourne un UrlTree qui redirige vers /home
  return router.createUrlTree(['/home']);
};
