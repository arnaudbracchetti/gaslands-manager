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
  WritableSignal,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Team, CreateTeamDto } from '../../teams/team.model';
import { CreateSeasonDto } from '../season.model';
import { QuickTeamCreate } from '../../teams/quick-team-create/quick-team-create';

@Component({
  selector: 'app-season-form',
  standalone: true,
  imports: [FormsModule, QuickTeamCreate],
  templateUrl: './season-form.html',
  styleUrl: './season-form.scss',
})
export class SeasonForm {
  // ── Inputs ──────────────────────────────────────────────────────────────────

  /** Vrai pendant que le parent attend la réponse de l'API. */
  saving: InputSignal<boolean> = input(false);

  /** Équipes de l'utilisateur connecté, pour le select. */
  teams: InputSignal<Team[]> = input<Team[]>([]);

  /** Vrai pendant que le parent attend la réponse de l'API de création d'équipe. */
  creatingTeam: InputSignal<boolean> = input(false);

  // ── Outputs ─────────────────────────────────────────────────────────────────

  saved: OutputEmitterRef<CreateSeasonDto> = output<CreateSeasonDto>();
  formCancel: OutputEmitterRef<void> = output<void>();

  /** Relaie la demande de création rapide d'équipe (QuickTeamCreate) au parent. */
  teamCreated: OutputEmitterRef<CreateTeamDto> = output<CreateTeamDto>();

  // ── État interne du formulaire ───────────────────────────────────────────────

  formName: WritableSignal<string> = signal('');
  formTeamId: WritableSignal<number | null> = signal<number | null>(null);

  /** Message d'erreur de validation locale */
  formError: WritableSignal<string> = signal('');

  /** Nombre d'équipes lors du dernier passage de l'effect — détecte un ajout. */
  private previousTeamsLength = 0;

  constructor() {
    // Après une création rapide (QuickTeamCreate), sélectionne automatiquement
    // la nouvelle équipe (dernière de la liste ajoutée).
    effect((): void => {
      const teams = this.teams();

      if (teams.length > this.previousTeamsLength && this.previousTeamsLength > 0) {
        this.formTeamId.set(teams[teams.length - 1].id);
      }

      this.previousTeamsLength = teams.length;
    });
  }

  /** Valide les champs et émet le DTO si tout est correct. teamId est optionnel. */
  saveForm(): void {
    const name = this.formName().trim();
    const teamId = this.formTeamId();

    if (!name) {
      this.formError.set('Le nom de la saison est obligatoire.');
      return;
    }

    this.formError.set('');
    // teamId undefined si aucune équipe sélectionnée (organisateur sans équipe)
    this.saved.emit({ name, ...(teamId !== null ? { teamId } : {}) });
  }

  /** Ferme le formulaire sans sauvegarder. */
  cancelForm(): void {
    this.formCancel.emit();
  }
}
