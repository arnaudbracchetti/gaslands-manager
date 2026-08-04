/**
 * Composant JerricansStep — écran Jerricans du wizard de fin de partie,
 * affiché quand le scénario porte `gain_jerricans` (butin manuel, cf.
 * `Scenario.gain_jerricans`) : saisie du nombre de jerricans gagnés par équipe
 * présente. Indépendant du revenu de base D6 par participant (Escarmouche,
 * tiré automatiquement à l'écran de résolution) — ce butin s'y cumule.
 *
 * Composant "dumb" : aucun appel HTTP ici.
 */
import { Component, InputSignal, OutputEmitterRef, WritableSignal, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { CampaignParticipant } from '../../campaign-participant.model';
import type { JerricanGainDto } from '../../game.model';

@Component({
  selector: 'app-jerricans-step',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './jerricans-step.html',
  styleUrl: './jerricans-step.scss',
})
export class JerricansStep {
  // ── Inputs ──────────────────────────────────────────────────────────────────

  /** Participants présents à la partie. */
  participants: InputSignal<CampaignParticipant[]> = input.required<CampaignParticipant[]>();

  /** Vrai pendant que le parent attend la réponse de l'API. */
  saving: InputSignal<boolean> = input<boolean>(false);

  // ── Outputs ─────────────────────────────────────────────────────────────────

  next: OutputEmitterRef<JerricanGainDto[]> = output<JerricanGainDto[]>();
  back: OutputEmitterRef<void> = output<void>();
  formCancel: OutputEmitterRef<void> = output<void>();

  // ── État interne ─────────────────────────────────────────────────────────────

  /** Jerricans gagnés par participant — clé = participantId. */
  private amounts: WritableSignal<Map<number, number>> = signal<Map<number, number>>(new Map());

  // ── Méthodes publiques ───────────────────────────────────────────────────────

  amountFor(participantId: number): number {
    return this.amounts().get(participantId) ?? 0;
  }

  setAmount(participantId: number, value: string): void {
    const parsed = Math.max(0, Number(value) || 0);
    const map = new Map(this.amounts());
    map.set(participantId, parsed);
    this.amounts.set(map);
  }

  onNext(): void {
    const entries: JerricanGainDto[] = this.participants()
      .map((p) => ({ participantId: p.id, amount: this.amountFor(p.id) }))
      .filter((e) => e.amount > 0);
    this.next.emit(entries);
  }

  onBack(): void {
    this.back.emit();
  }

  onCancel(): void {
    this.formCancel.emit();
  }
}
