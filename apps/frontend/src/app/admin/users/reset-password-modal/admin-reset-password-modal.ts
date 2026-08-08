/**
 * AdminResetPasswordModal — dialog "Réinitialiser le mot de passe" d'un
 * compte tiers, ouvert depuis AdminUsers.
 *
 * Composant **dumb**, mirroir de ChangePasswordModal (auto-service) MOINS le
 * champ "mot de passe actuel" — une réinitialisation admin n'a pas à le
 * connaître, cf. `User.resetPasswordAsAdmin` côté backend. Un input `user`
 * supplémentaire affiche la cible dans le titre, pour que l'admin confirme
 * visuellement le bon compte avant de soumettre. Compose `ModalShell` (chrome
 * mutualisé, mode "action").
 */
import { Component, InputSignal, OutputEmitterRef, Signal, WritableSignal, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { User } from '../../../auth/auth.model';
import { ModalShell } from '../../../shared/modal-shell/modal-shell';

@Component({
  selector: 'app-admin-reset-password-modal',
  standalone: true,
  imports: [FormsModule, ModalShell],
  templateUrl: './admin-reset-password-modal.html',
  styleUrl: './admin-reset-password-modal.scss',
})
export class AdminResetPasswordModal {
  /** Compte ciblé — affiché dans le titre pour confirmation visuelle. */
  user: InputSignal<User> = input.required<User>();

  /** État de sauvegarde/erreur — possédés par le parent (AdminUsers). */
  saving: InputSignal<boolean> = input(false);
  error: InputSignal<string> = input('');

  cancelled: OutputEmitterRef<void> = output<void>();
  submitted: OutputEmitterRef<string> = output<string>();

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
    () => this.saving() || this.newPassword().length < 6 || this.newPassword() !== this.confirmNewPassword(),
  );

  confirmLabel: Signal<string> = computed(() => (this.saving() ? 'Réinitialisation…' : 'Réinitialiser'));

  onSubmit(): void {
    if (this.submitDisabled()) {
      return;
    }
    this.submitted.emit(this.newPassword());
  }
}
