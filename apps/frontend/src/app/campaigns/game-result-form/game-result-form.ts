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
import type { CampaignParticipant } from '../campaign-participant.model';
import type { Game, RecordResultDto } from '../game.model';

/**
 * Barème des points de championnat par rang - miroir de POINTS_TABLE côté backend
 * (apps/backend/src/app/campaign/domain/campaign.ts). Le backend ne renvoie pas les
 * points calculés dans la réponse d'enregistrement : recalculé ici uniquement pour
 * l'aperçu avant validation.
 */
const POINTS_TABLE = [10, 5, 2, 1];

@Component({
  selector: 'app-game-result-form',
  standalone: true,
  imports: [CommonModule, DragDropModule],
  templateUrl: './game-result-form.html',
  styleUrl: './game-result-form.scss',
})
export class GameResultForm {
  // ── Inputs ──────────────────────────────────────────────────────────────────

  /** Partie dont on saisit le résultat - fournit le type (barème PC) et le scénario. */
  game = input.required<Game>();

  /** Participants VALIDATED de la saison — source de la liste de présence. */
  participants = input.required<CampaignParticipant[]>();

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
  presentParticipants = signal<CampaignParticipant[]>([]);

  /**
   * Nombre d'équipes "classées" : ceil(n/2) des présents.
   * Les autres sont "non classés" (hors points de championnat).
   */
  classifiedCount = computed<number>(() =>
    Math.ceil(this.presentParticipants().length / 2),
  );

  // ── Méthodes publiques ───────────────────────────────────────────────────────

  /** Indique si un participant est dans la liste des présents. */
  isPresent(participant: CampaignParticipant): boolean {
    return this.presentParticipants().some((p) => p.id === participant.id);
  }

  /**
   * Coche/décoche un participant.
   * - Cocher : ajoute en fin de liste des présents.
   * - Décocher : retire de la liste.
   */
  togglePresent(participant: CampaignParticipant): void {
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
  drop(event: CdkDragDrop<CampaignParticipant[]>): void {
    const list = [...this.presentParticipants()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.presentParticipants.set(list);
  }

  /** Vrai si le participant à l'index donné est parmi les "classés". */
  isClassified(index: number): boolean {
    return index + 1 <= this.classifiedCount();
  }

  /**
   * Points de championnat attribués à un rang donné (aperçu avant validation).
   * L'Escarmouche n'attribue jamais de PC ; seuls les "classés" (cf. classifiedCount)
   * touchent des points, selon le barème 10/5/2/1.
   */
  pointsForRank(rank: number): number {
    if (this.game().type !== 'EVENEMENT_TELE') return 0;
    if (rank > this.classifiedCount()) return 0;
    return POINTS_TABLE[rank - 1] ?? 0;
  }

  /** Fait remonter d'un rang le participant à l'index donné (no-op en tête de liste). */
  moveUp(index: number): void {
    if (index <= 0) return;
    const list = [...this.presentParticipants()];
    moveItemInArray(list, index, index - 1);
    this.presentParticipants.set(list);
  }

  /** Fait descendre d'un rang le participant à l'index donné (no-op en fin de liste). */
  moveDown(index: number): void {
    if (index >= this.presentParticipants().length - 1) return;
    const list = [...this.presentParticipants()];
    moveItemInArray(list, index, index + 1);
    this.presentParticipants.set(list);
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
