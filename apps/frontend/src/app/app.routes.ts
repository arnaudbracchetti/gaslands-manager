import { Route } from '@angular/router';

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
];
