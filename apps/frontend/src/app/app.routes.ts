import { Route } from '@angular/router';
import { authGuard } from './auth/auth.guard';

// Chaque route associe un chemin URL à un composant Angular
// loadComponent = lazy loading : le composant n'est chargé que quand l'utilisateur visite la page
export const appRoutes: Route[] = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full', // Redirige / vers /home
  },
  {
    path: 'home',
    loadComponent: () =>
      import('./home/home').then((m) => m.Home),
  },
  {
    path: 'teams',
    loadComponent: () =>
      import('./teams/teams').then((m) => m.Teams),
    // canActivate : le guard authGuard est exécuté avant de charger le composant.
    // Si l'utilisateur n'est pas connecté, il est redirigé vers /login.
    canActivate: [authGuard],
  },
  {
    path: 'vehicles',
    loadComponent: () =>
      import('./vehicles/vehicles').then((m) => m.Vehicles),
  },
  {
    path: 'weapons',
    loadComponent: () =>
      import('./weapons/weapons').then((m) => m.Weapons),
  },
  {
    path: 'rules',
    loadComponent: () =>
      import('./rules/rules').then((m) => m.Rules),
  },
  // ─── Routes d'authentification ────────────────────────────────────────────
  {
    path: 'login',
    loadComponent: () =>
      import('./auth/login/login').then((m) => m.Login),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./auth/register/register').then((m) => m.Register),
  },
  // Toute URL inconnue → page d'accueil
  {
    path: '**',
    redirectTo: 'home',
  },
];
