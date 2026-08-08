/**
 * ChangeTeamModal — modale de sélection d'équipe pour un participant.
 *
 * Composant **dumb** : reçoit la liste des équipes de l'utilisateur et l'équipe
 * actuellement engagée, et émet soit le `teamId` choisi (ou `null` pour se
 * désengager), soit `cancelled`.
 *
 * Visibilité contrôlée par le parent via `@if (showChangeTeamModal())` dans
 * `campaign-detail.html` — même pattern que `ConfirmModal`.
 */
import { Component, InputSignal, OutputEmitterRef, Signal, WritableSignal, computed, effect, input, output, signal } from '@angular/core';
import type { Team } from '../../teams/team.model';
import { ModalShell } from '../../shared/modal-shell/modal-shell';

@Component({
  selector: 'app-change-team-modal',
  standalone: true,
  imports: [ModalShell],
  templateUrl: './change-team-modal.html',
  styleUrl: './change-team-modal.scss',
})
export class ChangeTeamModal {
  /** Équipes disponibles pour l'utilisateur connecté. */
  teams: InputSignal<Team[]> = input.required<Team[]>();

  /** teamId actuellement engagé (null si sans équipe). */
  currentTeamId: InputSignal<number | null> = input.required<number | null>();

  /** Vrai si l'utilisateur est organisateur — affiche l'option "Sans équipe". */
  isOrganizer: InputSignal<boolean> = input(false);

  /** Budget en jerricans de la campagne - une équipe qui le dépasse est grisée, sauf si déjà engagée. */
  campaignBudget: InputSignal<number> = input.required<number>();

  /** Émis avec le teamId sélectionné (ou null pour se désengager). */
  confirmed: OutputEmitterRef<number | null> = output<number | null>();

  /** Émis quand l'utilisateur annule sans modifier. */
  cancelled: OutputEmitterRef<void> = output<void>();

  /** Sélection locale — initialisée depuis currentTeamId à l'ouverture. */
  selectedTeamId: WritableSignal<number | null> = signal(null);

  /**
   * teamId des équipes dont le coût cumulé dépasse le budget de la campagne - grisées,
   * sauf l'équipe déjà engagée (déjà validée par cette même campagne, donc forcément
   * dans le budget - on ne veut pas la griser à cause d'un arrondi ou d'un budget
   * modifié entre-temps qui la rendrait tout juste hors budget).
   */
  ineligibleTeamIds: Signal<ReadonlySet<number>> = computed(() => {
    const budget = this.campaignBudget();
    const currentTeamId = this.currentTeamId();
    return new Set(
      this.teams()
        .filter((t) => t.id !== currentTeamId && (t.vehiclesCost ?? 0) > budget)
        .map((t) => t.id),
    );
  });

  constructor() {
    // Synchronise la sélection initiale avec l'équipe courante dès que l'input est disponible.
    effect(() => {
      this.selectedTeamId.set(this.currentTeamId());
    });
  }

  onSelectChange(value: string): void {
    this.selectedTeamId.set(value === '' ? null : Number(value));
  }

  onConfirm(): void {
    this.confirmed.emit(this.selectedTeamId());
  }
}
