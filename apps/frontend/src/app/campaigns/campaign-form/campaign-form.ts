/**
 * Composant CampaignForm — formulaire de création d'une saison.
 *
 * Composant "dumb" (cf. team-form.ts) : valide localement puis émet un DTO
 * vers le parent qui appelle l'API. Pas de mode édition pour l'US1 — création
 * uniquement, donc pas d'effect() de pré-remplissage.
 *
 * La liste des équipes de l'utilisateur (`teams`) est chargée par le parent
 * (Campaigns) via TeamsService — réutilisation directe, pas de nouveau service.
 *
 * CA3 : si l'utilisateur n'a aucune équipe, le formulaire affiche un message
 * et désactive la soumission au lieu de présenter un select vide.
 *
 * Chrome (panel métal + coins + bande HazardTape + boutons) délégué à
 * ModalShell (mode "action") — le parent (Campaigns) n'a plus besoin
 * d'envelopper ce composant dans son propre overlay.
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
import { Team, CreateTeamDto, DEFAULT_CANS } from '../../teams/team.model';
import { CreateCampaignDto } from '../campaign.model';
import { QuickTeamCreate } from '../../teams/quick-team-create/quick-team-create';
import { Icon } from '../../shared/icon/icon';
import { ModalShell } from '../../shared/modal-shell/modal-shell';

@Component({
  selector: 'app-campaign-form',
  standalone: true,
  imports: [FormsModule, QuickTeamCreate, Icon, ModalShell],
  templateUrl: './campaign-form.html',
  styleUrl: './campaign-form.scss',
})
export class CampaignForm {
  // ── Inputs ──────────────────────────────────────────────────────────────────

  /** Vrai pendant que le parent attend la réponse de l'API. */
  saving: InputSignal<boolean> = input(false);

  /** Équipes de l'utilisateur connecté, pour le select. */
  teams: InputSignal<Team[]> = input<Team[]>([]);

  /** Vrai pendant que le parent attend la réponse de l'API de création d'équipe. */
  creatingTeam: InputSignal<boolean> = input(false);

  // ── Outputs ─────────────────────────────────────────────────────────────────

  saved: OutputEmitterRef<CreateCampaignDto> = output<CreateCampaignDto>();
  formCancel: OutputEmitterRef<void> = output<void>();

  /** Relaie la demande de création rapide d'équipe (QuickTeamCreate) au parent. */
  teamCreated: OutputEmitterRef<CreateTeamDto> = output<CreateTeamDto>();

  // ── État interne du formulaire ───────────────────────────────────────────────

  formName: WritableSignal<string> = signal('');
  formTeamId: WritableSignal<number | null> = signal<number | null>(null);
  /** Budget en jerricans imposé à toutes les équipes de la campagne - pré-rempli au défaut équipe (50). */
  formBudget: WritableSignal<number> = signal(DEFAULT_CANS);

  /** Message d'erreur de validation locale */
  formError: WritableSignal<string> = signal('');

  /** teamId des équipes dont le coût cumulé dépasse le budget actuellement saisi - grisées dans le select. */
  ineligibleTeamIds: Signal<ReadonlySet<number>> = computed(() => {
    const budget = this.formBudget();
    return new Set(
      this.teams()
        .filter((t) => (t.vehiclesCost ?? 0) > budget)
        .map((t) => t.id),
    );
  });

  /** Nombre d'équipes lors du dernier passage de l'effect — détecte un ajout. */
  private previousTeamsLength: number = 0;

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
    const budget = this.formBudget();

    if (!name) {
      this.formError.set('Le nom de la saison est obligatoire.');
      return;
    }
    if (teamId !== null && this.ineligibleTeamIds().has(teamId)) {
      this.formError.set('L\'équipe sélectionnée dépasse le budget choisi pour la campagne.');
      return;
    }

    this.formError.set('');
    // teamId undefined si aucune équipe sélectionnée (organisateur sans équipe)
    this.saved.emit({ name, budget, ...(teamId !== null ? { teamId } : {}) });
  }

  /** Ferme le formulaire sans sauvegarder. */
  cancelForm(): void {
    this.formCancel.emit();
  }
}
