/**
 * Composant TeamForm — formulaire de création ou de modification d'une équipe.
 *
 * C'est un composant "dumb" : il ne contacte pas l'API directement.
 * Il valide les données localement puis émet un DTO vers le parent
 * qui se charge de l'appel HTTP.
 *
 * Modes de fonctionnement :
 * - team = null  → mode création (champs vides, titre "Nouvelle équipe")
 * - team = Team  → mode édition  (champs pré-remplis, titre "Modifier l'équipe")
 *
 * L'effect() surveille le changement de l'input `team` pour mettre à jour
 * les champs automatiquement sans que le parent ait à le faire.
 *
 * Flow de sauvegarde :
 * 1. L'utilisateur clique sur "Enregistrer"
 * 2. Ce composant valide les champs (nom obligatoire)
 * 3. Si valide → émet saved(dto) vers le parent
 * 4. Le parent appelle l'API et passe saving=true pendant l'attente
 * 5. Le parent ferme le formulaire quand l'API répond
 */
import { Component, input, output, signal, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Team, CreateTeamDto, SPONSORS, DEFAULT_CANS } from '../team.model';

@Component({
  selector: 'app-team-form',
  standalone: true,
  // FormsModule est importé ici plutôt que dans le parent,
  // car c'est CE composant qui utilise [ngModel]
  imports: [FormsModule],
  templateUrl: './team-form.html',
  styleUrl: './team-form.scss',
})
export class TeamForm {
  // ── Inputs ──────────────────────────────────────────────────────────────────

  /**
   * Équipe à éditer (null = mode création).
   * Un effect() surveille ce signal pour pré-remplir les champs.
   */
  team = input<Team | null>(null);

  /**
   * Vrai pendant que le parent attend la réponse de l'API.
   * Désactive les boutons pour éviter les soumissions multiples.
   */
  saving = input(false);

  // ── Outputs ─────────────────────────────────────────────────────────────────

  /**
   * Émis avec le DTO validé quand l'utilisateur clique sur "Enregistrer".
   * Le parent décidera si c'est un create() ou un update() selon editingTeam.
   */
  saved = output<CreateTeamDto>();

  /** Émis quand l'utilisateur clique sur "Annuler". */
  cancel = output<void>();

  // ── État interne du formulaire ───────────────────────────────────────────────

  formName        = signal('');
  formSponsor     = signal('Rutherford');
  formCans        = signal(DEFAULT_CANS);
  formDescription = signal('');

  /** Message d'erreur de validation locale (ex: nom manquant) */
  formError = signal('');

  /** Titre calculé selon le mode : création ou édition */
  formTitle = computed(() =>
    this.team() ? '✏️ Modifier l\'équipe' : '➕ Nouvelle équipe'
  );

  /** Liste des sponsors pour le <select> */
  readonly sponsors = SPONSORS;

  constructor() {
    /**
     * effect() : réagit automatiquement quand l'input `team` change.
     *
     * Si team est fourni → on pré-remplit les champs (mode édition).
     * Si team est null   → on remet les valeurs par défaut (mode création).
     *
     * C'est le mécanisme clé du pattern "dumb component" : le parent
     * contrôle l'état, le formulaire s'adapte automatiquement.
     */
    effect(() => {
      const t = this.team();
      if (t) {
        this.formName.set(t.name);
        this.formSponsor.set(t.sponsor);
        this.formCans.set(t.cans);
        this.formDescription.set(t.description ?? '');
      } else {
        this.formName.set('');
        this.formSponsor.set('Rutherford');
        this.formCans.set(DEFAULT_CANS);
        this.formDescription.set('');
      }
      // On efface l'erreur précédente à chaque changement de mode
      this.formError.set('');
    });
  }

  // ── Méthodes ────────────────────────────────────────────────────────────────

  /** Valide les champs et émet le DTO si tout est correct. */
  saveForm(): void {
    const name = this.formName().trim();

    if (!name) {
      this.formError.set('Le nom de l\'équipe est obligatoire.');
      return;
    }

    this.formError.set('');

    const dto: CreateTeamDto = {
      name,
      sponsor:     this.formSponsor(),
      cans:        this.formCans(),
      description: this.formDescription().trim() || undefined,
    };

    // On émet le DTO — le parent se charge de l'appel HTTP
    this.saved.emit(dto);
  }

  /** Ferme le formulaire sans sauvegarder. */
  cancelForm(): void {
    this.cancel.emit();
  }
}
