/**
 * ModalShell — coquille de présentation commune à toutes les modales du
 * design system Terres Brûlées (panel métal + coins d'enregistrement +
 * bande HazardTape). Composant **dumb**, sans service — la projection de
 * contenu (`<ng-content>`) ne change pas ce statut, c'est la première
 * utilisation de ce mécanisme dans le projet.
 *
 * Deux modes couvrent les deux familles de modales de l'application :
 * - `action` (défaut) : deux boutons (Annuler/Action) ferment seuls la
 *   modale, aucune fermeture au clic hors de la boîte.
 * - `consultation` : un seul bouton (Fermer), fermeture par ce bouton OU par
 *   un clic hors de la boîte — même mécanique que celle codée à la main
 *   aujourd'hui dans EquipmentDetailModal/SequellaDetailModal.
 */
import { Component, InputSignal, OutputEmitterRef, input, output } from '@angular/core';

@Component({
  selector: 'app-modal-shell',
  standalone: true,
  imports: [],
  templateUrl: './modal-shell.html',
  styleUrl: './modal-shell.scss',
})
export class ModalShell {
  /** Libellé accessible du dialog (aria-label) — le shell ne connaît pas son contenu projeté. */
  ariaLabel: InputSignal<string> = input.required<string>();

  mode: InputSignal<'action' | 'consultation'> = input<'action' | 'consultation'>('action');

  /** Couleur des coins d'enregistrement + de la bande HazardTape + du bouton d'action. */
  variant: InputSignal<'danger' | 'primary'> = input<'danger' | 'primary'>('danger');

  /** Largeur du panel : 'md' (440px), 'lg' (480px, contenu structuré dense) ou 'xl' (560px, contenu riche : listes, règles détaillées). */
  size: InputSignal<'md' | 'lg' | 'xl'> = input<'md' | 'lg' | 'xl'>('md');

  /** Ignoré en mode 'consultation' (pas de bouton de confirmation). */
  confirmLabel: InputSignal<string> = input<string>('Confirmer');
  cancelLabel: InputSignal<string> = input<string>('Annuler');

  /** Ignoré en mode 'consultation'. */
  confirmDisabled: InputSignal<boolean> = input<boolean>(false);

  /** Émis uniquement en mode 'action' (le bouton n'existe pas en 'consultation'). */
  confirmed: OutputEmitterRef<void> = output<void>();

  /** Fermeture — clic sur le bouton dans les deux modes, plus clic hors de la boîte en mode 'consultation'. */
  cancelled: OutputEmitterRef<void> = output<void>();

  onOverlayClick(): void {
    if (this.mode() === 'consultation') {
      this.cancelled.emit();
    }
  }
}
