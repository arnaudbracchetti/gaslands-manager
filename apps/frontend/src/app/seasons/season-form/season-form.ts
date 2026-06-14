/**
 * Composant SeasonForm — formulaire de création d'une saison.
 *
 * Composant "dumb" (cf. team-form.ts) : valide localement puis émet un DTO
 * vers le parent qui appelle l'API. Pas de mode édition pour l'US1 — création
 * uniquement, donc pas d'effect() de pré-remplissage.
 *
 * La liste des équipes de l'utilisateur (`teams`) est chargée par le parent
 * (Seasons) via TeamsService — réutilisation directe, pas de nouveau service.
 *
 * CA3 : si l'utilisateur n'a aucune équipe, le formulaire affiche un message
 * et désactive la soumission au lieu de présenter un select vide.
 */
import {
  Component,
  InputSignal,
  OutputEmitterRef,
  Signal,
  WritableSignal,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Team } from '../../teams/team.model';
import { CreateSeasonDto } from '../season.model';

@Component({
  selector: 'app-season-form',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './season-form.html',
  styleUrl: './season-form.scss',
})
export class SeasonForm {
  // ── Inputs ──────────────────────────────────────────────────────────────────

  /** Vrai pendant que le parent attend la réponse de l'API. */
  saving: InputSignal<boolean> = input(false);

  /** Équipes de l'utilisateur connecté, pour le select. */
  teams: InputSignal<Team[]> = input<Team[]>([]);

  // ── Outputs ─────────────────────────────────────────────────────────────────

  saved: OutputEmitterRef<CreateSeasonDto> = output<CreateSeasonDto>();
  formCancel: OutputEmitterRef<void> = output<void>();

  // ── État interne du formulaire ───────────────────────────────────────────────

  formName: WritableSignal<string> = signal('');
  formTeamId: WritableSignal<number | null> = signal<number | null>(null);

  /** Message d'erreur de validation locale */
  formError: WritableSignal<string> = signal('');

  /** Vrai si l'utilisateur n'a aucune équipe (CA3) */
  noTeams: Signal<boolean> = computed((): boolean => this.teams().length === 0);

  constructor() {
    // Pré-sélectionne la première équipe disponible dès que `teams` est chargé,
    // sans écraser un choix déjà fait par l'utilisateur.
    effect((): void => {
      const teams = this.teams();
      if (teams.length > 0 && this.formTeamId() === null) {
        this.formTeamId.set(teams[0].id);
      }
    });
  }

  /** Valide les champs et émet le DTO si tout est correct. */
  saveForm(): void {
    const name = this.formName().trim();
    const teamId = this.formTeamId();

    if (!name) {
      this.formError.set('Le nom de la saison est obligatoire.');
      return;
    }

    if (teamId === null) {
      this.formError.set('Vous devez sélectionner une équipe.');
      return;
    }

    this.formError.set('');
    this.saved.emit({ name, teamId });
  }

  /** Ferme le formulaire sans sauvegarder. */
  cancelForm(): void {
    this.formCancel.emit();
  }
}
