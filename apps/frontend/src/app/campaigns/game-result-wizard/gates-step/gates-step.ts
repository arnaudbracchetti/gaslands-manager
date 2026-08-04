/**
 * Composant GatesStep — écran Portes franchies du wizard de fin de partie
 * (Événement Télévisé, uniquement si le scénario porte `franchissement_portes`,
 * cf. `Scenario.franchissement_portes`) : saisie du nombre de portes franchies
 * par équipe classée (exploit, US-B2).
 *
 * Composant "dumb" : extrait de l'ancien champ intégré à `RankingStep` — même
 * mécanique de saisie, désormais son propre écran.
 */
import { Component, InputSignal, OutputEmitterRef, WritableSignal, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { CampaignParticipant } from '../../campaign-participant.model';
import type { GatesEntry } from '../../game.model';

@Component({
  selector: 'app-gates-step',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gates-step.html',
  styleUrl: './gates-step.scss',
})
export class GatesStep {
  // ── Inputs ──────────────────────────────────────────────────────────────────

  /** Participants classés à l'écran Classement, dans l'ordre du rang. */
  participants: InputSignal<CampaignParticipant[]> = input.required<CampaignParticipant[]>();

  /** Vrai pendant que le parent attend la réponse de l'API. */
  saving: InputSignal<boolean> = input<boolean>(false);

  // ── Outputs ─────────────────────────────────────────────────────────────────

  next: OutputEmitterRef<GatesEntry[]> = output<GatesEntry[]>();
  back: OutputEmitterRef<void> = output<void>();
  formCancel: OutputEmitterRef<void> = output<void>();

  // ── État interne ─────────────────────────────────────────────────────────────

  /** Portes franchies par participant — clé = participantId. */
  private gatesCrossed: WritableSignal<Map<number, number>> = signal<Map<number, number>>(new Map());

  // ── Méthodes publiques ───────────────────────────────────────────────────────

  gatesCrossedFor(participantId: number): number {
    return this.gatesCrossed().get(participantId) ?? 0;
  }

  setGatesCrossed(participantId: number, value: string): void {
    const parsed = Math.max(0, Number(value) || 0);
    const map = new Map(this.gatesCrossed());
    map.set(participantId, parsed);
    this.gatesCrossed.set(map);
  }

  onNext(): void {
    const entries: GatesEntry[] = this.participants()
      .map((p) => ({ participantId: p.id, gatesCrossed: this.gatesCrossedFor(p.id) }))
      .filter((e) => e.gatesCrossed > 0);
    this.next.emit(entries);
  }

  onBack(): void {
    this.back.emit();
  }

  onCancel(): void {
    this.formCancel.emit();
  }
}
