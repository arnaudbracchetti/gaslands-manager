/**
 * Composant GameResultForm — formulaire de saisie du classement d'une partie.
 *
 * Composant "dumb" : reçoit les participants via `input()`, émet un `RecordResultDto`
 * via `output()`. Toute la logique de classement (présence, ordre) est gérée en
 * local via Signals — aucun appel HTTP ici.
 *
 * Drag-and-drop via Angular CDK (`@angular/cdk/drag-drop`) pour réordonner
 * la liste des présents. `moveItemInArray` modifie une copie du tableau, puis
 * le signal `presentParticipants` est remis à jour (pattern zoneless obligatoire).
 *
 * Règle de classement : seuls les `ceil(n/2)` premiers sont "classés".
 * Ex. : 3 présents → 2 classés ; 4 présents → 2 classés ; 5 → 3 classés.
 */
import { Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import type { SeasonParticipant } from '../season-participant.model';
import type { RecordResultDto } from '../game.model';

@Component({
  selector: 'app-game-result-form',
  standalone: true,
  imports: [CommonModule, DragDropModule],
  templateUrl: './game-result-form.html',
  styleUrl: './game-result-form.scss',
})
export class GameResultForm {
  // ── Inputs ──────────────────────────────────────────────────────────────────

  /** Participants VALIDATED de la saison — source de la liste de présence. */
  participants = input.required<SeasonParticipant[]>();

  /** Vrai pendant que le parent attend la réponse de l'API. */
  saving = input<boolean>(false);

  // ── Outputs ─────────────────────────────────────────────────────────────────

  /** Émis avec le DTO de classement une fois le formulaire soumis. */
  saved = output<RecordResultDto>();

  /** Émis quand l'utilisateur annule sans soumettre. */
  formCancel = output<void>();

  // ── État interne ─────────────────────────────────────────────────────────────

  /**
   * Participants cochés comme présents, dans l'ordre de classement.
   * L'index dans ce tableau détermine le rang (index 0 = rang 1).
   */
  presentParticipants = signal<SeasonParticipant[]>([]);

  /**
   * Nombre d'équipes "classées" : ceil(n/2) des présents.
   * Les autres sont "non classés" (hors points de championnat).
   */
  classifiedCount = computed<number>(() =>
    Math.ceil(this.presentParticipants().length / 2),
  );

  // ── Méthodes publiques ───────────────────────────────────────────────────────

  /** Indique si un participant est dans la liste des présents. */
  isPresent(participant: SeasonParticipant): boolean {
    return this.presentParticipants().some((p) => p.id === participant.id);
  }

  /**
   * Coche/décoche un participant.
   * - Cocher : ajoute en fin de liste des présents.
   * - Décocher : retire de la liste.
   */
  togglePresent(participant: SeasonParticipant): void {
    const current = this.presentParticipants();
    if (this.isPresent(participant)) {
      this.presentParticipants.set(current.filter((p) => p.id !== participant.id));
    } else {
      this.presentParticipants.set([...current, participant]);
    }
  }

  /**
   * Callback CDK Drag-and-Drop : met à jour l'ordre de la liste après un glisser.
   * `moveItemInArray` mute un tableau en place — on travaille sur une copie
   * pour ne pas violer l'immuabilité du signal.
   */
  drop(event: CdkDragDrop<SeasonParticipant[]>): void {
    const list = [...this.presentParticipants()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.presentParticipants.set(list);
  }

  /** Vrai si le participant à l'index donné est parmi les "classés". */
  isClassified(index: number): boolean {
    return index + 1 <= this.classifiedCount();
  }

  /** Construit et émet le DTO de classement. */
  onSubmit(): void {
    const results = this.presentParticipants().map((p, i) => ({
      participantId: p.id,
      rank: i + 1,
    }));
    this.saved.emit({ results });
  }

  /** Émet l'événement d'annulation. */
  onCancel(): void {
    this.formCancel.emit();
  }
}
