/**
 * Composant Teams — écran de gestion des équipes Gaslands.
 *
 * C'est le composant "smart" (ou "container") de cet écran :
 * il orchestre les données et les actions, mais délègue l'affichage
 * à des composants "dumb" spécialisés :
 *
 *   - TeamCard      → affiche une carte d'équipe (lecture + boutons Modifier/Supprimer/Ajouter un véhicule)
 *   - TeamForm      → gère le formulaire de création / modification
 *
 * La configuration d'un véhicule (création OU gestion d'équipement d'un
 * véhicule existant) ne se fait plus dans une modale projetée ici, mais sur
 * une page dédiée (`VehicleConfiguratorPage`, routes `/teams/:teamId/vehicles/new`
 * et `/teams/:teamId/vehicles/:vehicleId` — cf. `app.routes.ts`) : `Teams` se
 * contente de NAVIGUER vers cette page (cf. `openVehicleBuilder`/`openVehicleEditor`),
 * et de se recharger naturellement (`ngOnInit` → `loadTeams`) au retour sur `/teams`.
 *
 * Responsabilités de ce composant :
 * - Charger la liste des équipes via TeamsService
 * - Contrôler la visibilité du formulaire (showForm, editingTeam)
 * - Recevoir le DTO validé de TeamForm et appeler l'API (create / update)
 * - Gérer la suppression (confirmation + appel API)
 * - Naviguer vers la page de configuration de véhicule — cf. doc de
 *   `openVehicleBuilder`/`openVehicleEditor`
 * - Gérer la suppression d'un véhicule — cf. doc de `deleteVehicle`
 * - Charger et résumer les véhicules de chaque équipe pour l'affichage sur sa
 *   carte (vehicleSummaries) — cf. doc de `loadVehicleSummaries`
 * - Afficher les erreurs API globales
 */
import { Component, OnInit, WritableSignal, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of, map, catchError } from 'rxjs';
import { TeamsService } from './teams.service';
import { Team, CreateTeamDto } from './team.model';
import { TeamCard } from './team-card/team-card';
import { TeamForm } from './team-form/team-form';
import { VehicleService } from './vehicle-configurator/vehicle.service';
import { Vehicle } from './vehicle-configurator/vehicle-builder.model';
import { CatalogService } from '../catalog/catalog.service';
import { Sponsor } from '../catalog/catalog.model';
import { buildVehicleSummary, TeamVehiclePair, VehicleSummary } from './vehicle-summary';

@Component({
  selector: 'app-teams',
  standalone: true,
  // On importe les sous-composants ici pour pouvoir les utiliser dans le template.
  // FormsModule n'est PAS nécessaire ici — il est importé dans TeamForm uniquement.
  imports: [TeamCard, TeamForm],
  templateUrl: './teams.html',
  styleUrl: './teams.scss',
})
export class Teams implements OnInit {
  // ── Services injectés ──────────────────────────────────────────────────────
  private teamsService: TeamsService = inject(TeamsService);
  private router: Router = inject(Router);

  // VehicleService/CatalogService : nécessaires UNIQUEMENT pour construire le
  // résumé des véhicules de chaque équipe (cf. `loadVehicleSummaries`) — Teams
  // ne participe à AUCUNE étape du flux de configuration lui-même (c'est le rôle
  // de VehicleConfiguratorPage, sur sa propre route). Deux besoins distincts,
  // déjà servis par les mêmes services — inutile d'en créer de nouveaux.
  private vehicleService: VehicleService = inject(VehicleService);
  private catalogService: CatalogService = inject(CatalogService);

  // ── État de la liste ───────────────────────────────────────────────────────

  /** Liste des équipes chargées depuis l'API */
  teams: WritableSignal<Team[]> = signal<Team[]>([]);

  /** Vrai pendant le chargement initial */
  loading: WritableSignal<boolean> = signal(true);

  /** Message d'erreur API affiché à l'utilisateur (vide = pas d'erreur) */
  error: WritableSignal<string> = signal('');

  // ── État du formulaire ─────────────────────────────────────────────────────

  /** Vrai quand le formulaire de création/modification est visible */
  showForm: WritableSignal<boolean> = signal(false);

  /**
   * Équipe en cours d'édition, passée en [input] à TeamForm.
   * null  = mode création (formulaire vide)
   * Team  = mode édition  (formulaire pré-rempli via effect dans TeamForm)
   */
  editingTeam: WritableSignal<Team | null> = signal<Team | null>(null);

  /** Vrai pendant l'appel API de sauvegarde (passé à TeamForm pour désactiver les boutons) */
  saving: WritableSignal<boolean> = signal(false);

  // ── Résumés des véhicules (affichage sur les cartes) ────────────────────────

  /**
   * Résumés des véhicules de chaque équipe, indexés par id d'équipe — alimente
   * l'input `vehicles` de `TeamCard` (cf. `teams.html`, `vehicleSummaries().get(team.id)`).
   *
   * `Map` plutôt qu'un champ directement posé sur `Team` : `Team` est le DTO
   * RENVOYÉ PAR L'API (cf. `team.model.ts`) — lui ajouter une donnée calculée
   * côté frontend brouillerait la frontière entre "ce que le serveur affirme"
   * et "ce que le client a déduit localement". Un signal séparé, recalculé à
   * chaque `loadTeams()`, garde cette frontière nette (même choix que
   * `editingTeam`/`vehicleModal` : un signal dédié par responsabilité).
   *
   * Équipe absente de la Map = pas encore chargée OU sans véhicule — `teams.html`
   * traite les deux cas de la même façon via `?? []` (liste vide, rien à afficher).
   * Pas de signal de chargement dédié : le remplissage est rapide (catalogue en
   * mémoire côté backend) et asynchrone par nature — la liste apparaît dès que
   * prête, sans accroc visuel justifiant un état "en cours" supplémentaire.
   */
  vehicleSummaries: WritableSignal<Map<number, VehicleSummary[]>> = signal(new Map<number, VehicleSummary[]>());

  // ── Cycle de vie ───────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadTeams();
  }

  // ── Chargement ─────────────────────────────────────────────────────────────

  /** Charge toutes les équipes depuis l'API et met à jour le signal */
  loadTeams(): void {
    this.loading.set(true);
    this.error.set('');

    this.teamsService.getAll().subscribe({
      next: (teams: Team[]) => {
        this.teams.set(teams);
        this.loading.set(false);
        // Toujours déclenché après un chargement réussi — y compris après un
        // simple rafraîchissement (ex: fermeture de la modale de configuration
        // de véhicule, cf. `closeVehicleModal`) : `vehicleCount` a pu changer,
        // la liste de véhicules affichée doit suivre.
        this.loadVehicleSummaries(teams);
      },
      error: () => {
        this.error.set('Impossible de charger vos équipes. Vérifiez votre connexion.');
        this.loading.set(false);
      },
    });
  }

  /**
   * Construit `vehicleSummaries` : pour chaque équipe possédant au moins un
   * véhicule (`vehicleCount > 0` — filtre qui évite des appels inutiles pour les
   * équipes vides, même logique d'économie que `getAvailableImprovements` qui ne
   * liste que pour UN véhicule existant), charge EN PARALLÈLE :
   *   1. ses véhicules bruts        → `vehicleService.getAllForTeam`
   *   2. le catalogue de son sponsor → `catalogService.getSponsorByName`
   * (les deux ingrédients dont `buildVehicleSummary` a besoin pour résoudre
   * `nomInterne → {nom, prix}` — cf. son en-tête).
   *
   * Deux niveaux de `forkJoin` :
   *   - intérieur : les 2 requêtes d'UNE équipe, combinées en un seul résumé
   *   - extérieur : les résumés de TOUTES les équipes concernées, combinés en une Map
   *
   * `catchError` PAR ÉQUIPE plutôt que global : si le sponsor d'une équipe est
   * introuvable (incohérence de données — cf. `Error` levée par
   * `getAvailableImprovements`, backend) ou le réseau capricieux, cette équipe
   * affiche simplement une liste vide — la grille entière ne doit pas se figer
   * pour autant (résilience, même esprit que la suppression optimiste de `deleteTeam`).
   */
  private loadVehicleSummaries(teams: Team[]): void {
    const teamsWithVehicles: Team[] = teams.filter((team: Team): boolean => (team.vehicleCount ?? 0) > 0);

    if (teamsWithVehicles.length === 0) {
      this.vehicleSummaries.set(new Map<number, VehicleSummary[]>());
      return;
    }

    const perTeam$ = teamsWithVehicles.map((team: Team) =>
      forkJoin([
        this.vehicleService.getAllForTeam(team.id),
        this.catalogService.getSponsorByName(team.sponsor),
      ]).pipe(
        map(([vehicles, catalog]: [Vehicle[], Sponsor]): [number, VehicleSummary[]] => [
          team.id,
          vehicles.map((vehicle: Vehicle): VehicleSummary => buildVehicleSummary(vehicle, catalog)),
        ]),
        catchError(() => of<[number, VehicleSummary[]]>([team.id, []])),
      ),
    );

    forkJoin(perTeam$).subscribe((entries: [number, VehicleSummary[]][]): void => {
      this.vehicleSummaries.set(new Map<number, VehicleSummary[]>(entries));
    });
  }

  // ── Gestion du formulaire ──────────────────────────────────────────────────

  /**
   * Ouvre le formulaire en mode création.
   * TeamForm détecte automatiquement que team = null et vide les champs.
   */
  openCreate(): void {
    this.editingTeam.set(null);
    this.showForm.set(true);
  }

  /**
   * Ouvre le formulaire en mode édition.
   * TeamForm détecte le changement de l'input `team` et pré-remplit les champs.
   */
  openEdit(team: Team): void {
    this.editingTeam.set(team);
    this.showForm.set(true);
  }

  /** Ferme le formulaire sans sauvegarder */
  cancelForm(): void {
    this.showForm.set(false);
    this.editingTeam.set(null);
  }

  /**
   * Reçoit le DTO validé de TeamForm et appelle l'API.
   *
   * TeamForm a déjà validé les données (nom obligatoire etc.).
   * Ce composant décide si c'est un create() ou un update() selon editingTeam.
   */
  onSaved(dto: CreateTeamDto): void {
    this.saving.set(true);
    this.error.set('');

    const editing = this.editingTeam();

    // Choix de l'opération selon le mode : édition ou création
    const request$ = editing
      ? this.teamsService.update(editing.id, dto)
      : this.teamsService.create(dto);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.editingTeam.set(null);
        this.loadTeams(); // Rechargement depuis l'API pour rester synchronisé
      },
      error: () => {
        this.error.set('Une erreur est survenue. Veuillez réessayer.');
        this.saving.set(false);
      },
    });
  }

  // ── Suppression ────────────────────────────────────────────────────────────

  /**
   * Supprime une équipe après confirmation.
   * Reçu depuis TeamCard via l'output (deleteClicked).
   *
   * Suppression optimiste : on retire l'équipe du signal local immédiatement
   * pour une UX réactive, puis on appelle l'API.
   */
  deleteTeam(team: Team): void {
    if (!window.confirm(`Supprimer l'équipe "${team.name}" ? Cette action est irréversible.`)) {
      return;
    }

    // Suppression optimiste — (list: Team[]) et (t: Team) annotés (règle `parameter: true`).
    this.teams.update((list: Team[]) => list.filter((t: Team) => t.id !== team.id));

    this.teamsService.remove(team.id).subscribe({
      error: () => {
        this.error.set('Erreur lors de la suppression. La liste a été actualisée.');
        this.loadTeams(); // Restaure l'état réel depuis l'API
      },
    });
  }

  // ── Navigation vers la configuration de véhicule (création OU édition) ─────

  /**
   * Navigue vers la page de construction d'un véhicule pour l'équipe choisie
   * (`/teams/:teamId/vehicles/new` — `VehicleConfiguratorPage` y affichera le
   * choix du véhicule, cf. son en-tête). Reçu depuis TeamCard via l'output
   * (addVehicleClicked).
   *
   * Au retour sur `/teams` (lien "Retour"/`done`), le composant `Teams` est
   * recréé par le routeur → `ngOnInit` rappelle `loadTeams()` automatiquement :
   * pas de rechargement explicite à orchestrer ici (`vehicleCount` a pu changer
   * dès le choix du véhicule — persistance immédiate d'un véhicule "nu").
   */
  openVehicleBuilder(team: Team): void {
    this.router.navigate(['/teams', team.id, 'vehicles', 'new']);
  }

  /**
   * Navigue vers la page de gestion d'équipement du véhicule choisi
   * (`/teams/:teamId/vehicles/:vehicleId` — `VehicleConfiguratorPage` y charge
   * directement ce véhicule, cf. son en-tête). Reçu depuis TeamCard via
   * l'output (editVehicleClicked) — porte une `TeamVehiclePair` (cf. sa doc)
   * dont on extrait les deux informations utiles : l'id de l'équipe (route) et
   * l'id du véhicule (isolement de l'entité brute). `VehicleSummary` ne porte
   * pas l'objet `Team` complet — seul `TeamCard` peut assembler la paire au
   * moment du clic.
   *
   * Même remarque que `openVehicleBuilder` pour le rafraîchissement au retour
   * (l'équipement a pu changer — ajouts ET retraits — le coût affiché sur la
   * carte sera resynchronisé par `loadTeams()`).
   */
  openVehicleEditor(pair: TeamVehiclePair): void {
    this.router.navigate(['/teams', pair.team.id, 'vehicles', pair.vehicle.id]);
  }

  /**
   * Supprime un véhicule après confirmation (mirroir de `deleteTeam` — même
   * pattern `window.confirm`, même message-type "irréversible").
   *
   * PAS de suppression optimiste, à la différence de `deleteTeam` : retirer ce
   * véhicule peut faire retomber `vehicleCount` à 0 et déverrouiller le choix
   * du sponsor (`hasVehicles`/`locked`, cf. `TeamForm`/`SponsorCarousel`) — un
   * effet de bord que seul un rechargement complet (`loadTeams`, qui recharge
   * À LA FOIS `teams` ET `vehicleSummaries`) peut refléter correctement. Une
   * suppression optimiste du seul résumé laisserait `vehicleCount` désynchronisé
   * jusqu'au prochain chargement — risque d'incohérence que `deleteTeam` n'a
   * pas (supprimer une équipe ne déverrouille rien).
   */
  deleteVehicle(pair: TeamVehiclePair): void {
    if (!window.confirm(`Supprimer le véhicule "${pair.vehicle.nom}" ? Cette action est irréversible.`)) {
      return;
    }

    this.vehicleService.remove(pair.vehicle.id).subscribe({
      next: () => this.loadTeams(),
      error: () => this.error.set('Erreur lors de la suppression du véhicule.'),
    });
  }
}
