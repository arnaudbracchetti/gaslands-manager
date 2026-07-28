/**
 * ConfirmModal — boîte de dialogue de confirmation générique.
 *
 * Composant **dumb** : affiche un message et deux boutons (confirmer / annuler),
 * émet le choix via outputs. La visibilité est contrôlée par le parent via
 * `@if (showX())` — même pattern que `ChangeTeamModal`.
 *
 * Compose `ModalShell` (chrome Panel métal + coins + HazardTape mutualisé,
 * mode "action") — ne garde en propre que le message projeté.
 */
import { Component, InputSignal, OutputEmitterRef, input, output } from '@angular/core';
import { ModalShell } from '../modal-shell/modal-shell';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [ModalShell],
  templateUrl: './confirm-modal.html',
  styleUrl: './confirm-modal.scss',
})
export class ConfirmModal {
  /** Texte de la question affichée dans la boîte. */
  message: InputSignal<string> = input.required<string>();

  /** Label du bouton de confirmation (défaut : "Confirmer"). */
  confirmLabel: InputSignal<string> = input<string>('Confirmer');

  /** Label du bouton d'annulation (défaut : "Annuler"). */
  cancelLabel: InputSignal<string> = input<string>('Annuler');

  /**
   * Variante visuelle du bouton de confirmation.
   * - `danger` (défaut) : rouge rouille — suppressions irréversibles.
   * - `primary` : jaune danger — confirmations neutres (promotion, transition…).
   */
  variant: InputSignal<'danger' | 'primary'> = input<'danger' | 'primary'>('danger');

  /** Émis quand l'utilisateur valide. */
  confirmed: OutputEmitterRef<void> = output<void>();

  /** Émis quand l'utilisateur annule. */
  cancelled: OutputEmitterRef<void> = output<void>();
}
