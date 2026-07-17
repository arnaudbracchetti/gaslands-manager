/**
 * Composant PresenceStep — écran 1 du wizard de fin de partie (Événement
 * Télévisé et Escarmouche) : cocher les équipes présentes à la partie.
 *
 * Composant "dumb" : reçoit les participants via `input()`, émet la liste des
 * présents (ordre de coche) via `output()`. Le classement (ordre) est délégué
 * à `RankingStep` (Événement Télévisé uniquement) — cet écran ne fait que
 * déterminer QUI a joué, jamais dans quel ordre.
 */
import { Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { CampaignParticipant } from '../../campaign-participant.model';

/** Une partie oppose au moins deux participants — jamais une partie en solo. */
const MIN_PRESENT = 2;

@Component({
  selector: 'app-presence-step',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './presence-step.html',
  styleUrl: './presence-step.scss',
})
export class PresenceStep {
  // ── Inputs ──────────────────────────────────────────────────────────────────

  /** Participants VALIDATED de la campagne — source de la liste de présence. */
  participants = input.required<CampaignParticipant[]>();

  /** Vrai pendant que le parent attend une réponse de l'API. */
  saving = input<boolean>(false);

  // ── Outputs ─────────────────────────────────────────────────────────────────

  /** Émis avec les ids présents (ordre de coche) une fois l'étape validée. */
  next = output<number[]>();

  /** Émis à chaque changement de la liste des présents. */
  presentParticipantsChanged = output<number[]>();

  /** Émis quand l'utilisateur annule sans soumettre. */
  formCancel = output<void>();

  // ── État interne ─────────────────────────────────────────────────────────────

  /** Ids présents, dans l'ordre de coche. */
  presentIds = signal<number[]>([]);

  presentCount = computed<number>(() => this.presentIds().length);

  /** Une partie oppose au moins deux participants — jamais une partie en solo. */
  hasMinimumPresence = computed<boolean>(() => this.presentCount() >= MIN_PRESENT);

  // ── Méthodes publiques ───────────────────────────────────────────────────────

  isPresent(participant: CampaignParticipant): boolean {
    return this.presentIds().includes(participant.id);
  }

  togglePresent(participant: CampaignParticipant): void {
    const current = this.presentIds();
    const next = this.isPresent(participant)
      ? current.filter((id) => id !== participant.id)
      : [...current, participant.id];
    this.presentIds.set(next);
    this.presentParticipantsChanged.emit(next);
  }

  onNext(): void {
    this.next.emit(this.presentIds());
  }

  onCancel(): void {
    this.formCancel.emit();
  }
}
