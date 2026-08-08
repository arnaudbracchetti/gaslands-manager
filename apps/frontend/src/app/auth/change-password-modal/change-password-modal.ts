/**
 * ChangePasswordModal — dialog "Changer le mot de passe".
 *
 * Composant **dumb**, extrait de UserDetailsModal (jusque-là un sous-
 * formulaire du dialog "Détails du compte") pour devenir son propre point
 * d'entrée de menu. Pas d'input `user` : ChangePasswordDto ne référence
 * aucune donnée de profil à pré-remplir. Compose `ModalShell` (chrome
 * Panel métal + coins + HazardTape mutualisé, mode "action").
 */
import { Component, InputSignal, OutputEmitterRef, Signal, WritableSignal, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { ChangePasswordDto } from '../auth.model';
import { ModalShell } from '../../shared/modal-shell/modal-shell';

@Component({
  selector: 'app-change-password-modal',
  standalone: true,
  imports: [FormsModule, ModalShell],
  templateUrl: './change-password-modal.html',
  styleUrl: './change-password-modal.scss',
})
export class ChangePasswordModal {
  /** État de sauvegarde/erreur — possédés par le parent (App). */
  saving: InputSignal<boolean> = input(false);
  error: InputSignal<string> = input('');

  cancelled: OutputEmitterRef<void> = output<void>();
  submitted: OutputEmitterRef<ChangePasswordDto> = output<ChangePasswordDto>();

  currentPassword: WritableSignal<string> = signal('');
  newPassword: WritableSignal<string> = signal('');
  confirmNewPassword: WritableSignal<string> = signal('');

  /**
   * Coche client uniquement — indépendante de error() (erreur serveur).
   * Ne se déclenche qu'une fois les DEUX champs renseignés : sinon l'erreur
   * apparaîtrait dès la première frappe du premier champ, avant même que
   * l'utilisateur ait pu atteindre le second.
   */
  passwordMismatch: Signal<boolean> = computed(
    () => this.confirmNewPassword() !== '' && this.newPassword() !== this.confirmNewPassword(),
  );

  passwordTooShort: Signal<boolean> = computed(() => this.newPassword().length > 0 && this.newPassword().length < 6);

  submitDisabled: Signal<boolean> = computed(
    () =>
      this.saving() ||
      this.currentPassword() === '' ||
      this.newPassword().length < 6 ||
      this.newPassword() !== this.confirmNewPassword(),
  );

  confirmLabel: Signal<string> = computed(() => (this.saving() ? 'Enregistrement…' : 'Changer le mot de passe'));

  onSubmit(): void {
    if (this.submitDisabled()) {
      return;
    }
    this.submitted.emit({
      currentPassword: this.currentPassword(),
      newPassword: this.newPassword(),
    });
  }
}
