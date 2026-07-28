/**
 * UserDetailsModal — dialog "Détails du compte".
 *
 * Composant **dumb** : reçoit l'utilisateur courant et pré-remplit le
 * formulaire Informations (prénom/nom/pseudo/email), avec son propre état
 * de sauvegarde/erreur possédé par le parent (App) — même principe que
 * ChangeTeamModal (pré-remplissage via effect() sur l'input `user`,
 * resynchronisé à chaque ouverture puisque l'instance du composant persiste
 * entre deux ouvertures du dialog). Le changement de mot de passe vit dans
 * sa propre modale, ChangePasswordModal. Compose `ModalShell` (chrome
 * Panel métal + coins + HazardTape mutualisé, mode "action").
 */
import { Component, InputSignal, OutputEmitterRef, Signal, WritableSignal, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { UpdateProfileDto, User } from '../auth.model';
import { ModalShell } from '../../shared/modal-shell/modal-shell';

@Component({
  selector: 'app-user-details-modal',
  standalone: true,
  imports: [FormsModule, ModalShell],
  templateUrl: './user-details-modal.html',
  styleUrl: './user-details-modal.scss',
})
export class UserDetailsModal {
  /** Utilisateur courant — source de pré-remplissage du formulaire. */
  user: InputSignal<User> = input.required<User>();

  /** État de sauvegarde/erreur du formulaire "Informations" — possédés par le parent. */
  profileSaving: InputSignal<boolean> = input(false);
  profileError: InputSignal<string> = input('');

  cancelled: OutputEmitterRef<void> = output<void>();
  profileSubmitted: OutputEmitterRef<UpdateProfileDto> = output<UpdateProfileDto>();

  firstName: WritableSignal<string> = signal('');
  lastName: WritableSignal<string> = signal('');
  pseudo: WritableSignal<string> = signal('');
  email: WritableSignal<string> = signal('');

  profileSubmitDisabled: Signal<boolean> = computed(
    () =>
      this.profileSaving() ||
      !this.firstName().trim() ||
      !this.lastName().trim() ||
      !this.pseudo().trim() ||
      !this.email().trim(),
  );

  confirmLabel: Signal<string> = computed(() => (this.profileSaving() ? 'Enregistrement…' : 'Enregistrer'));

  constructor() {
    // Pré-remplissage — même pattern que ChangeTeamModal : l'instance du
    // composant persiste entre deux ouvertures, effect() resynchronise à
    // chaque changement de l'input `user`.
    effect(() => {
      const u = this.user();
      this.firstName.set(u.firstName);
      this.lastName.set(u.lastName);
      // Valeur BRUTE (`pseudo`), pas `callName` : on édite le champ source,
      // pas le nom d'affichage qui en est dérivé côté backend.
      this.pseudo.set(u.pseudo);
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
      pseudo: this.pseudo(),
      email: this.email(),
    });
  }
}
