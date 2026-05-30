/**
 * Composant Teams — écran de gestion des équipes Gaslands.
 *
 * Fonctionnalités :
 * - Afficher la liste des équipes de l'utilisateur connecté
 * - Créer une nouvelle équipe via un formulaire inline
 * - Modifier une équipe existante (formulaire pré-rempli)
 * - Supprimer une équipe (avec confirmation)
 *
 * Architecture Angular 21 zoneless + Signals :
 * - Tous les états réactifs sont des signal() ou computed()
 * - Les templates utilisent @if / @for (nouveau control flow Angular 17+)
 * - Le two-way binding sur les inputs utilise [ngModel] + (ngModelChange)
 *   (car [(ngModel)] n'est pas compatible avec les Signals en mode zoneless)
 */
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TeamsService } from './teams.service';
import { Team, CreateTeamDto, SPONSORS, DEFAULT_CANS } from './team.model';

@Component({
  selector: 'app-teams',
  standalone: true,
  // FormsModule : nécessaire pour [ngModel] dans le formulaire
  imports: [FormsModule],
  templateUrl: './teams.html',
  styleUrl: './teams.scss',
})
export class Teams implements OnInit {
  // ── Services injectés ──────────────────────────────────────────────────────
  private teamsService = inject(TeamsService);

  // ── État de la liste ───────────────────────────────────────────────────────

  /** Liste des équipes chargées depuis l'API */
  teams = signal<Team[]>([]);

  /** Vrai pendant le chargement initial */
  loading = signal(true);

  /** Message d'erreur affiché à l'utilisateur (vide = pas d'erreur) */
  error = signal('');

  // ── État du formulaire ─────────────────────────────────────────────────────

  /** Vrai quand le formulaire de création/modification est visible */
  showForm = signal(false);

  /**
   * Équipe en cours d'édition.
   * null  = mode création (nouveau formulaire vide)
   * Team  = mode édition (formulaire pré-rempli)
   */
  editingTeam = signal<Team | null>(null);

  /** Titre du formulaire, calculé automatiquement selon le mode */
  formTitle = computed(() =>
    this.editingTeam() ? '✏️ Modifier l\'équipe' : '➕ Nouvelle équipe'
  );

  /** Champs du formulaire, initialisés avec les valeurs par défaut */
  formName = signal('');
  formSponsor = signal('Rutherford');
  formCans = signal(DEFAULT_CANS);
  formDescription = signal('');

  /** Vrai pendant la sauvegarde (désactive le bouton pour éviter les doublons) */
  saving = signal(false);

  /** Liste des sponsors exposée au template */
  readonly sponsors = SPONSORS;

  // ── Cycle de vie ───────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadTeams();
  }

  // ── Méthodes privées ───────────────────────────────────────────────────────

  /** Charge toutes les équipes depuis l'API et met à jour le signal */
  private loadTeams(): void {
    this.loading.set(true);
    this.error.set('');

    this.teamsService.getAll().subscribe({
      next: (teams) => {
        this.teams.set(teams);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger vos équipes. Vérifiez votre connexion.');
        this.loading.set(false);
      },
    });
  }

  // ── Gestion du formulaire ──────────────────────────────────────────────────

  /** Ouvre le formulaire en mode création (champs vides) */
  openCreate(): void {
    this.editingTeam.set(null);
    this.formName.set('');
    this.formSponsor.set('Rutherford');
    this.formCans.set(DEFAULT_CANS);
    this.formDescription.set('');
    this.showForm.set(true);
  }

  /** Ouvre le formulaire en mode édition (champs pré-remplis) */
  openEdit(team: Team): void {
    this.editingTeam.set(team);
    this.formName.set(team.name);
    this.formSponsor.set(team.sponsor);
    this.formCans.set(team.cans);
    this.formDescription.set(team.description ?? '');
    this.showForm.set(true);
  }

  /** Ferme le formulaire sans sauvegarder */
  cancelForm(): void {
    this.showForm.set(false);
    this.editingTeam.set(null);
  }

  /**
   * Sauvegarde le formulaire : crée ou met à jour selon le mode.
   *
   * Après la sauvegarde, on recharge la liste depuis l'API pour rester
   * synchronisé avec la base de données (évite les incohérences).
   */
  saveForm(): void {
    const name = this.formName().trim();
    if (!name) {
      this.error.set('Le nom de l\'équipe est obligatoire.');
      return;
    }

    const dto: CreateTeamDto = {
      name,
      sponsor: this.formSponsor(),
      cans: this.formCans(),
      description: this.formDescription().trim() || undefined,
    };

    this.saving.set(true);
    this.error.set('');

    const editing = this.editingTeam();

    // Si on est en mode édition, on appelle update() ; sinon create()
    const request$ = editing
      ? this.teamsService.update(editing.id, dto)
      : this.teamsService.create(dto);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.editingTeam.set(null);
        this.loadTeams(); // Rechargement depuis l'API
      },
      error: () => {
        this.error.set('Une erreur est survenue. Veuillez réessayer.');
        this.saving.set(false);
      },
    });
  }

  // ── Suppression ────────────────────────────────────────────────────────────

  /**
   * Supprime une équipe après confirmation de l'utilisateur.
   *
   * On retire immédiatement l'équipe du signal local pour une UX réactive
   * (l'utilisateur voit le changement instantanément), puis on appelle l'API.
   * Si l'API échoue, on recharge la liste pour restaurer l'état réel.
   */
  deleteTeam(team: Team): void {
    if (!window.confirm(`Supprimer l'équipe "${team.name}" ? Cette action est irréversible.`)) {
      return;
    }

    // Suppression optimiste : on retire l'équipe du signal avant la réponse API
    this.teams.update((list) => list.filter((t) => t.id !== team.id));

    this.teamsService.remove(team.id).subscribe({
      error: () => {
        // En cas d'erreur, on recharge pour restaurer l'état réel
        this.error.set('Erreur lors de la suppression. La liste a été actualisée.');
        this.loadTeams();
      },
    });
  }
}
