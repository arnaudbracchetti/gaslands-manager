/**
 * Composant Teams — écran de gestion des équipes Gaslands.
 *
 * C'est le composant "smart" (ou "container") de cet écran :
 * il orchestre les données et les actions, mais délègue l'affichage
 * à des composants "dumb" spécialisés :
 *
 *   - TeamCard  → affiche une carte d'équipe (lecture + boutons Modifier/Supprimer)
 *   - TeamForm  → gère le formulaire de création / modification
 *
 * Responsabilités de ce composant :
 * - Charger la liste des équipes via TeamsService
 * - Contrôler la visibilité du formulaire (showForm, editingTeam)
 * - Recevoir le DTO validé de TeamForm et appeler l'API (create / update)
 * - Gérer la suppression (confirmation + appel API)
 * - Afficher les erreurs API globales
 */
import { Component, OnInit, WritableSignal, inject, signal } from '@angular/core';
import { TeamsService } from './teams.service';
import { Team, CreateTeamDto } from './team.model';
import { TeamCard } from './team-card/team-card';
import { TeamForm } from './team-form/team-form';

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
      },
      error: () => {
        this.error.set('Impossible de charger vos équipes. Vérifiez votre connexion.');
        this.loading.set(false);
      },
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
}
