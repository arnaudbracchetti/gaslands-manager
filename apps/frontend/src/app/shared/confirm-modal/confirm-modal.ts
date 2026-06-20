/**
 * ConfirmModal — boîte de dialogue de confirmation générique.
 *
 * Composant **dumb** : affiche un message et deux boutons (confirmer / annuler),
 * émet le choix via outputs. La visibilité est contrôlée par le parent via
 * `@if (showX())` — même pattern que ChangeTeamModal et TourelleAssignmentModal.
 *
 * Design : Panel métal + coins d'enregistrement + bande HazardTape en tête,
 * boutons fidèles au composant Button du design system Terres Brûlées.
 */
import { Component, InputSignal, OutputEmitterRef, input, output } from '@angular/core';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [],
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
