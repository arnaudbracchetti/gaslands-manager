/**
 * Composant ParticipantList — affiche une liste de participants d'une saison.
 *
 * Composant "dumb" (cf. season-card.ts) : reçoit la liste via input(), émet
 * un événement `validate` quand l'utilisateur clique sur "Valider"/"Refuser".
 * `showActions` contrôle l'affichage de ces boutons — le parent (SeasonDetail)
 * ne les passe à `true` que pour la liste "En attente" et si l'utilisateur
 * courant est organisateur (`myRole`).
 */
import { Component, InputSignal, OutputEmitterRef, input, output } from '@angular/core';
import { SeasonParticipant } from '../season-participant.model';

@Component({
  selector: 'app-participant-list',
  standalone: true,
  imports: [],
  templateUrl: './participant-list.html',
  styleUrl: './participant-list.scss',
})
export class ParticipantList {
  /** Les participants à afficher. */
  participants: InputSignal<SeasonParticipant[]> = input.required<SeasonParticipant[]>();

  /** Affiche les boutons Valider/Refuser sur chaque ligne. */
  showActions: InputSignal<boolean> = input<boolean>(false);

  /** Émis au clic sur "Valider" (accept: true) ou "Refuser" (accept: false). */
  validate: OutputEmitterRef<{ pid: number; accept: boolean }> = output<{ pid: number; accept: boolean }>();

  onValidate(pid: number, accept: boolean): void {
    this.validate.emit({ pid, accept });
  }
}
