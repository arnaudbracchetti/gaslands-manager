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
    // data.docSlug : chapitre de documentation utilisateur lié depuis le shell
    // (app.ts lit la route active la plus profonde) pour le lien "❓ Aide sur
    // cet écran" — cf. docs/plans/2026-07-16-documentation-utilisateur-design.md.
    data: { docSlug: 'equipes' },
  },
  {
    path: 'campaigns',
    loadComponent: () =>
      import('./campaigns/campaigns').then((m) => m.Campaigns),
    canActivate: [authGuard],
    data: { docSlug: 'campagnes' },
  },
  {
    path: 'campaigns/join/:code',
    loadComponent: () =>
      import('./campaigns/campaign-join/campaign-join').then((m) => m.CampaignJoin),
    canActivate: [authGuard],
    data: { docSlug: 'campagnes' },
  },
  {
    path: 'campaigns/:id',
    loadComponent: () =>
      import('./campaigns/campaign-detail/campaign-detail').then((m) => m.CampaignDetail),
    canActivate: [authGuard],
    data: { docSlug: 'campagnes' },
  },
  // Atelier campagne (phase garage post-partie) — liste des véhicules de l'équipe
  // engagée ; la configuration d'un véhicule se fait sur la route dédiée ci-dessous
  // (même principe que teams/:teamId/vehicles/:vehicleId).
  {
    path: 'campaigns/:id/atelier',
    loadComponent: () =>
      import('./campaigns/atelier-page/atelier-page').then((m) => m.AtelierPage),
    canActivate: [authGuard],
    data: { docSlug: 'atelier' },
  },
  // Configuration d'équipement d'un véhicule de l'atelier — réutilise EquipmentManager
  // via AtelierEquipmentDataSource (fournie au niveau de ce composant).
  {
    path: 'campaigns/:id/atelier/vehicles/:vehicleId',
    loadComponent: () =>
      import('./campaigns/atelier-vehicle-page/atelier-vehicle-page').then((m) => m.AtelierVehiclePage),
    canActivate: [authGuard],
    data: { docSlug: 'atelier' },
  },
  // Consultation en lecture seule de l'atelier d'un AUTRE participant — vue
  // maître-détail sur une seule page (pas de sous-route véhicule, contrairement
  // à l'atelier "personnel" ci-dessus).
  {
    path: 'campaigns/:id/participants/:pid/atelier',
    loadComponent: () =>
      import('./campaigns/participant-atelier-page/participant-atelier-page').then((m) => m.ParticipantAtelierPage),
    canActivate: [authGuard],
    data: { docSlug: 'atelier' },
  },
  // ─── Édition d'une équipe (hub : infos + véhicules) ────────────────────────
  // Déclarée AVANT les routes vehicles pour éviter tout conflit de paramètres.
  {
    path: 'teams/:id/edit',
    loadComponent: () =>
      import('./teams/team-edit-page/team-edit-page').then((m) => m.TeamEditPage),
    canActivate: [authGuard],
    data: { docSlug: 'equipes' },
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
    data: { docSlug: 'construction-vehicule' },
  },
  {
    path: 'teams/:teamId/vehicles/:vehicleId',
    loadComponent: () =>
      import('./teams/vehicle-configurator-page/vehicle-configurator-page').then((m) => m.VehicleConfiguratorPage),
    canActivate: [authGuard],
    data: { docSlug: 'construction-vehicule' },
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
  // ─── Documentation utilisateur ──────────────────────────────────────────────
  // Remplace l'ancienne page /rules (règles du jeu Gaslands) : documente
  // désormais le fonctionnement de l'application elle-même, pas les règles du
  // livre. Publique (pas d'authGuard), comme /rules avant elle. Pas de piège
  // d'ordre ici (contrairement à 'new' vs ':vehicleId' plus haut) : 'documentation'
  // (un seul segment) et 'documentation/:slug' (deux segments) ne peuvent jamais
  // matcher la même URL.
  {
    path: 'documentation',
    loadComponent: () =>
      import('./documentation/documentation').then((m) => m.Documentation),
  },
  {
    path: 'documentation/:slug',
    loadComponent: () =>
      import('./documentation/documentation-chapter/documentation-chapter').then(
        (m) => m.DocumentationChapter,
      ),
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
