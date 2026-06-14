/**
 * Composant Seasons — écran de gestion des saisons Gaslands.
 *
 * Composant "smart" (cf. teams.ts) : orchestre les données et délègue
 * l'affichage à :
 *   - SeasonCard → affiche une carte de saison (nom, état, badges)
 *   - SeasonForm → formulaire de création
 *
 * Pour l'US1, seules la liste et la création sont implémentées (pas d'édition,
 * pas de suppression, pas de navigation vers un détail).
 */
import { Component, OnInit, WritableSignal, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SeasonsService } from './seasons.service';
import { Season, CreateSeasonDto } from './season.model';
import { SeasonCard } from './season-card/season-card';
import { SeasonForm } from './season-form/season-form';
import { TeamsService } from '../teams/teams.service';
import { Team } from '../teams/team.model';

@Component({
  selector: 'app-seasons',
  standalone: true,
  imports: [SeasonCard, SeasonForm, FormsModule],
  templateUrl: './seasons.html',
  styleUrl: './seasons.scss',
})
export class Seasons implements OnInit {
  private seasonsService: SeasonsService = inject(SeasonsService);
  private teamsService: TeamsService = inject(TeamsService);
  private router: Router = inject(Router);

  /** Liste des saisons chargées depuis l'API */
  seasons: WritableSignal<Season[]> = signal<Season[]>([]);

  /** Vrai pendant le chargement initial */
  loading: WritableSignal<boolean> = signal(true);

  /** Message d'erreur API affiché à l'utilisateur (vide = pas d'erreur) */
  error: WritableSignal<string> = signal('');

  /** Vrai quand le formulaire de création est visible */
  showForm: WritableSignal<boolean> = signal(false);

  /** Vrai pendant l'appel API de création (passé à SeasonForm pour désactiver les boutons) */
  saving: WritableSignal<boolean> = signal(false);

  /** Équipes de l'utilisateur connecté, pour le select de SeasonForm (CA3) */
  userTeams: WritableSignal<Team[]> = signal<Team[]>([]);

  /** Code d'invitation saisi dans le champ "Rejoindre via code" */
  joinCode: WritableSignal<string> = signal('');

  /** Ids des saisons pour lesquelles l'utilisateur a une demande PENDING (US4) */
  pendingSeasonIds: WritableSignal<Set<number>> = signal(new Set<number>());

  /** seasonId → nombre de demandes PENDING à valider, pour les saisons organisées (US4) */
  organizedPendingCounts: WritableSignal<Map<number, number>> = signal(new Map<number, number>());

  ngOnInit(): void {
    this.loadSeasons();
    this.loadUserTeams();
    this.loadPendingRequests();
    this.loadOrganizedPendingCounts();
  }

  /** Charge toutes les saisons depuis l'API et met à jour le signal */
  loadSeasons(): void {
    this.loading.set(true);
    this.error.set('');

    this.seasonsService.getAll().subscribe({
      next: (seasons: Season[]) => {
        this.seasons.set(seasons);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger vos saisons. Vérifiez votre connexion.');
        this.loading.set(false);
      },
    });
  }

  /** Charge les équipes de l'utilisateur pour le select de SeasonForm */
  private loadUserTeams(): void {
    this.teamsService.getAll().subscribe({
      next: (teams: Team[]) => this.userTeams.set(teams),
      // Une erreur ici laisse simplement userTeams vide → SeasonForm affiche
      // le message CA3 ("vous devez d'abord créer une équipe").
      error: () => this.userTeams.set([]),
    });
  }

  /**
   * Charge les saisons où l'utilisateur a une demande PENDING (badge "⏳ En
   * attente de validation"). Erreur silencieuse — badge secondaire, ne doit
   * pas bloquer l'affichage des saisons (cf. loadUserTeams).
   */
  private loadPendingRequests(): void {
    this.seasonsService.getPending().subscribe({
      next: (seasons: Season[]) => this.pendingSeasonIds.set(new Set(seasons.map((s) => s.id))),
      error: () => this.pendingSeasonIds.set(new Set()),
    });
  }

  /**
   * Charge les saisons organisées par l'utilisateur ayant des demandes
   * PENDING à valider (badge "⚠️ N à valider"). Erreur silencieuse — même
   * raisonnement que loadPendingRequests.
   */
  private loadOrganizedPendingCounts(): void {
    this.seasonsService.getOrganizingPendingRequests().subscribe({
      next: (seasons: Season[]) => {
        const counts = new Map<number, number>();
        seasons.forEach((season) => counts.set(season.id, season.pendingRequestsCount ?? 0));
        this.organizedPendingCounts.set(counts);
      },
      error: () => this.organizedPendingCounts.set(new Map()),
    });
  }

  /** Ouvre le formulaire de création */
  openCreate(): void {
    this.showForm.set(true);
  }

  /** Navigue vers la page de jointure pour le code saisi. */
  goToJoin(): void {
    const code = this.joinCode().trim();
    if (code) {
      this.router.navigate(['/seasons/join', code]);
    }
  }

  /** Ferme le formulaire sans sauvegarder */
  cancelForm(): void {
    this.showForm.set(false);
  }

  /**
   * Reçoit le DTO validé de SeasonForm et appelle l'API de création.
   */
  onSaved(dto: CreateSeasonDto): void {
    this.saving.set(true);
    this.error.set('');

    this.seasonsService.create(dto).subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.loadSeasons();
      },
      error: () => {
        this.error.set('Une erreur est survenue. Veuillez réessayer.');
        this.saving.set(false);
      },
    });
  }
}
