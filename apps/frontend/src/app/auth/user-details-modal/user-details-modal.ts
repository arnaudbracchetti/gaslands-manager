/**
 * UserDetailsModal — dialog "Détails du compte".
 *
 * Composant **dumb** : reçoit l'utilisateur courant et pré-remplit deux
 * sous-formulaires indépendants (Informations / Mot de passe), chacun avec
 * son propre état de sauvegarde/erreur possédé par le parent (App) — même
 * principe que ChangeTeamModal (pré-remplissage via effect() sur l'input
 * `user`, resynchronisé à chaque ouverture puisque l'instance du composant
 * persiste entre deux ouvertures du dialog).
 *
 * Le rôle est affiché en texte, jamais dans un champ éditable : ce dialog
 * ne permet à un utilisateur de modifier que sa propre identité, jamais son
 * rôle (réservé à AdminSeedService / à un futur écran admin dédié).
 */
import { Component, InputSignal, OutputEmitterRef, Signal, WritableSignal, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { ChangePasswordDto, UpdateProfileDto, User } from '../auth.model';

@Component({
  selector: 'app-user-details-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './user-details-modal.html',
  styleUrl: './user-details-modal.scss',
})
export class UserDetailsModal {
  /** Utilisateur courant — source de pré-remplissage des deux formulaires. */
  user: InputSignal<User> = input.required<User>();

  /** État de sauvegarde/erreur du sous-formulaire "Informations" — possédés par le parent. */
  profileSaving: InputSignal<boolean> = input(false);
  profileError: InputSignal<string> = input('');

  /** État de sauvegarde/erreur du sous-formulaire "Mot de passe" — possédés par le parent. */
  passwordSaving: InputSignal<boolean> = input(false);
  passwordError: InputSignal<string> = input('');

  closed: OutputEmitterRef<void> = output<void>();
  profileSubmitted: OutputEmitterRef<UpdateProfileDto> = output<UpdateProfileDto>();
  passwordSubmitted: OutputEmitterRef<ChangePasswordDto> = output<ChangePasswordDto>();

  firstName: WritableSignal<string> = signal('');
  lastName: WritableSignal<string> = signal('');
  email: WritableSignal<string> = signal('');

  currentPassword: WritableSignal<string> = signal('');
  newPassword: WritableSignal<string> = signal('');
  confirmNewPassword: WritableSignal<string> = signal('');

  /** Rôle affiché en lecture seule — jamais éditable ici. */
  roleLabel: Signal<string> = computed(() => (this.user().role === 'admin' ? 'Administrateur' : 'Utilisateur'));

  profileSubmitDisabled: Signal<boolean> = computed(
    () => this.profileSaving() || !this.firstName().trim() || !this.lastName().trim() || !this.email().trim(),
  );

  /** Coche client uniquement — indépendante de passwordError() (erreur serveur). */
  passwordMismatch: Signal<boolean> = computed(
    () => this.newPassword() !== '' && this.newPassword() !== this.confirmNewPassword(),
  );

  passwordTooShort: Signal<boolean> = computed(() => this.newPassword().length > 0 && this.newPassword().length < 6);

  passwordSubmitDisabled: Signal<boolean> = computed(
    () =>
      this.passwordSaving() ||
      this.currentPassword() === '' ||
      this.newPassword().length < 6 ||
      this.newPassword() !== this.confirmNewPassword(),
  );

  constructor() {
    // Pré-remplissage — même pattern que ChangeTeamModal : l'instance du
    // composant persiste entre deux ouvertures, effect() resynchronise à
    // chaque changement de l'input `user`.
    effect(() => {
      const u = this.user();
      this.firstName.set(u.firstName);
      this.lastName.set(u.lastName);
      this.email.set(u.email);
    });
  }

  onProfileSubmit(): void {
    if (this.profileSubmitDisabled()) {
      return;
    }
    this.profileSubmitted.emit({
      firstName: this.firstName(),
      lastName: this.lastName(),
      email: this.email(),
    });
  }

  onPasswordSubmit(): void {
    if (this.passwordSubmitDisabled()) {
      return;
    }
    this.passwordSubmitted.emit({
      currentPassword: this.currentPassword(),
      newPassword: this.newPassword(),
    });
  }

  onClose(): void {
    this.closed.emit();
  }
}
