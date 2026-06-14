import { Route } from '@angular/router';
import { authGuard } from './auth/auth.guard';
import { adminGuard } from './auth/admin.guard';

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
    path: 'seasons',
    loadComponent: () =>
      import('./seasons/seasons').then((m) => m.Seasons),
    canActivate: [authGuard],
  },
  {
    path: 'seasons/join/:code',
    loadComponent: () =>
      import('./seasons/season-join/season-join').then((m) => m.SeasonJoin),
    canActivate: [authGuard],
  },
  // ─── Configuration de véhicule (page dédiée, ex-modale) ────────────────────
  // Deux routes vers le même composant : 'new' (segment littéral) DOIT être
  // déclaré AVANT ':vehicleId' (paramètre), sinon '/teams/5/vehicles/new'
  // matcherait la route paramétrée avec vehicleId = "new".
  {
    path: 'teams/:teamId/vehicles/new',
    loadComponent: () =>
      import('./teams/vehicle-configurator-page/vehicle-configurator-page').then((m) => m.VehicleConfiguratorPage),
    canActivate: [authGuard],
  },
  {
    path: 'teams/:teamId/vehicles/:vehicleId',
    loadComponent: () =>
      import('./teams/vehicle-configurator-page/vehicle-configurator-page').then((m) => m.VehicleConfiguratorPage),
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
  // ─── Administration (réservé aux admins) ───────────────────────────────────
  {
    path: 'admin/users',
    loadComponent: () =>
      import('./admin/users/admin-users').then((m) => m.AdminUsers),
    canActivate: [authGuard, adminGuard],
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
