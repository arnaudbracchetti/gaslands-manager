/**
 * Composant SabotageStep — écran Sabotage du wizard de fin de partie, TOUJOURS
 * affiché (pas de gate scénario, contrairement à Portes/Jerricans) : déclaration
 * rétroactive de l'organisateur, sur annonce orale à table, du nombre de points de
 * sabotage dépensés par équipe pendant la partie. Le solde de sabotage n'est jamais
 * affiché à l'écran (secret, y compris pour l'organisateur) — rien à valider ici, le
 * clamp au solde réellement disponible est entièrement fait côté serveur.
 *
 * Composant "dumb" : aucun appel HTTP ici.
 */
import { Component, InputSignal, OutputEmitterRef, WritableSignal, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { CampaignParticipant } from '../../campaign-participant.model';
import type { SabotageSpentEntry } from '../../game.model';

@Component({
  selector: 'app-sabotage-step',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sabotage-step.html',
  styleUrl: './sabotage-step.scss',
})
export class SabotageStep {
  // ── Inputs ──────────────────────────────────────────────────────────────────

  /** Participants présents à la partie. */
  participants: InputSignal<CampaignParticipant[]> = input.required<CampaignParticipant[]>();

  /** Vrai pendant que le parent attend la réponse de l'API. */
  saving: InputSignal<boolean> = input<boolean>(false);

  // ── Outputs ─────────────────────────────────────────────────────────────────

  next: OutputEmitterRef<SabotageSpentEntry[]> = output<SabotageSpentEntry[]>();
  back: OutputEmitterRef<void> = output<void>();
  formCancel: OutputEmitterRef<void> = output<void>();

  // ── État interne ─────────────────────────────────────────────────────────────

  /** Points de sabotage déclarés par participant — clé = participantId. */
  private pointsSpent: WritableSignal<Map<number, number>> = signal<Map<number, number>>(new Map());

  // ── Méthodes publiques ───────────────────────────────────────────────────────

  pointsSpentFor(participantId: number): number {
    return this.pointsSpent().get(participantId) ?? 0;
  }

  setPointsSpent(participantId: number, value: string): void {
    const parsed = Math.max(0, Number(value) || 0);
    const map = new Map(this.pointsSpent());
    map.set(participantId, parsed);
    this.pointsSpent.set(map);
  }

  onNext(): void {
    const entries: SabotageSpentEntry[] = this.participants()
      .map((p) => ({ participantId: p.id, pointsSpent: this.pointsSpentFor(p.id) }))
      .filter((e) => e.pointsSpent > 0);
    this.next.emit(entries);
  }

  onBack(): void {
    this.back.emit();
  }

  onCancel(): void {
    this.formCancel.emit();
  }
}
