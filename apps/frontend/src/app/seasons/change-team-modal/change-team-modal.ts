/**
 * ChangeTeamModal — modale de sélection d'équipe pour un participant.
 *
 * Composant **dumb** : reçoit la liste des équipes de l'utilisateur et l'équipe
 * actuellement engagée, et émet soit le `teamId` choisi (ou `null` pour se
 * désengager), soit `cancelled`.
 *
 * Pattern identique à TourelleAssignmentModal : visibilité contrôlée par le
 * parent via `@if (showChangeTeamModal())` dans `season-detail.html`.
 */
import { Component, InputSignal, OutputEmitterRef, WritableSignal, effect, input, output, signal } from '@angular/core';
import type { Team } from '../../teams/team.model';

@Component({
  selector: 'app-change-team-modal',
  standalone: true,
  imports: [],
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

  /** Émis avec le teamId sélectionné (ou null pour se désengager). */
  confirmed: OutputEmitterRef<number | null> = output<number | null>();

  /** Émis quand l'utilisateur annule sans modifier. */
  cancelled: OutputEmitterRef<void> = output<void>();

  /** Sélection locale — initialisée depuis currentTeamId à l'ouverture. */
  selectedTeamId: WritableSignal<number | null> = signal(null);

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
