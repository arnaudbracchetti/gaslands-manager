/**
 * Composant InviteLink — affiche le code d'invitation d'une saison avec un
 * bouton "Copier".
 *
 * Composant "dumb" (cf. season-card.ts) : reçoit le code via input(), ne
 * connaît aucun service. `navigator.clipboard.writeText` est une API
 * synchrone côté composant — le retour visuel "Copié !" est géré localement
 * via un signal et `setTimeout` (pas besoin de remonter l'info au parent).
 */
import { Component, InputSignal, WritableSignal, input, signal } from '@angular/core';

@Component({
  selector: 'app-invite-link',
  standalone: true,
  imports: [],
  templateUrl: './invite-link.html',
  styleUrl: './invite-link.scss',
})
export class InviteLink {
  /** Le code d'invitation à afficher et copier. */
  inviteCode: InputSignal<string> = input.required<string>();

  /** Vrai juste après un clic sur "Copier" — affiche un retour visuel temporaire. */
  copied: WritableSignal<boolean> = signal(false);

  /** Copie le code dans le presse-papiers et affiche un retour visuel temporaire. */
  copyCode(): void {
    navigator.clipboard.writeText(this.inviteCode()).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }
}
