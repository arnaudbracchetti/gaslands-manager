/**
 * Composant RankingStep — écran Classement du wizard de fin de partie
 * (Événement Télévisé uniquement) : ordonne par glisser-déposer les équipes
 * présentes (déjà sélectionnées à l'écran Présence, cf. `PresenceStep`).
 *
 * Composant "dumb" : reçoit les présents déjà choisis via `input()` (ordre de
 * présence, servant de point de départ), émet un `RankingEntry[]` via
 * `output()` une fois validé. Aucun appel HTTP ici. Les portes franchies sont
 * saisies séparément (écran Portes, cf. `GatesStep`).
 *
 * Drag-and-drop via Angular CDK (`@angular/cdk/drag-drop`). `moveItemInArray`
 * modifie une copie du tableau, puis le signal `orderedParticipants` est remis
 * à jour (pattern zoneless obligatoire).
 *
 * Règle de classement : seuls les `ceil(n/2)` premiers sont "classés".
 * Ex. : 3 présents → 2 classés ; 4 présents → 2 classés ; 5 → 3 classés.
 */
import { Component, InputSignal, OutputEmitterRef, Signal, WritableSignal, computed, effect, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import type { CampaignParticipant } from '../../campaign-participant.model';
import type { Game, RankingEntry } from '../../game.model';

/**
 * Barème des points de championnat par rang - miroir de POINTS_TABLE côté backend
 * (apps/backend/src/app/campaign/domain/campaign.ts). Le backend ne renvoie pas les
 * points calculés dans la réponse d'enregistrement : recalculé ici uniquement pour
 * l'aperçu avant validation.
 */
const POINTS_TABLE = [10, 5, 2, 1];

@Component({
  selector: 'app-ranking-step',
  standalone: true,
  imports: [CommonModule, DragDropModule],
  templateUrl: './ranking-step.html',
  styleUrl: './ranking-step.scss',
})
export class RankingStep {
  // ── Inputs ──────────────────────────────────────────────────────────────────

  /** Partie dont on saisit le résultat - fournit le type (barème PC) et le scénario. */
  game: InputSignal<Game> = input.required<Game>();

  /** Participants présents, déjà sélectionnés à l'écran Présence (ordre de départ). */
  presentParticipants: InputSignal<CampaignParticipant[]> = input.required<CampaignParticipant[]>();

  /** Vrai pendant que le parent attend la réponse de l'API. */
  saving: InputSignal<boolean> = input<boolean>(false);

  // ── Outputs ─────────────────────────────────────────────────────────────────

  /** Émis avec le classement une fois l'étape validée. */
  next: OutputEmitterRef<RankingEntry[]> = output<RankingEntry[]>();

  /** Émis pour revenir à l'écran Présence. */
  back: OutputEmitterRef<void> = output<void>();

  /** Émis quand l'utilisateur annule sans soumettre. */
  formCancel: OutputEmitterRef<void> = output<void>();

  // ── État interne ─────────────────────────────────────────────────────────────

  /** Copie réordonnable de `presentParticipants()` — initialisée à chaque changement de l'input. */
  orderedParticipants: WritableSignal<CampaignParticipant[]> = signal<CampaignParticipant[]>([]);

  /**
   * Nombre d'équipes "classées" : ceil(n/2) des présents.
   * Les autres sont "non classés" (hors points de championnat).
   */
  classifiedCount: Signal<number> = computed<number>(() =>
    Math.ceil(this.orderedParticipants().length / 2),
  );

  constructor() {
    // Pré-remplit l'ordre de départ depuis la présence (cf. COMPONENTS.md — effect()
    // pour réagir à un input() Signal). Se ré-exécute si l'utilisateur revient sur
    // l'écran Présence puis re-soumet une sélection différente.
    effect(() => {
      this.orderedParticipants.set([...this.presentParticipants()]);
    });
  }

  // ── Méthodes publiques ───────────────────────────────────────────────────────

  /**
   * Callback CDK Drag-and-Drop : met à jour l'ordre de la liste après un glisser.
   * `moveItemInArray` mute un tableau en place — on travaille sur une copie
   * pour ne pas violer l'immuabilité du signal.
   */
  drop(event: CdkDragDrop<CampaignParticipant[]>): void {
    const list = [...this.orderedParticipants()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.orderedParticipants.set(list);
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
    const list = [...this.orderedParticipants()];
    moveItemInArray(list, index, index - 1);
    this.orderedParticipants.set(list);
  }

  /** Fait descendre d'un rang le participant à l'index donné (no-op en fin de liste). */
  moveDown(index: number): void {
    if (index >= this.orderedParticipants().length - 1) return;
    const list = [...this.orderedParticipants()];
    moveItemInArray(list, index, index + 1);
    this.orderedParticipants.set(list);
  }

  /** Construit et émet le classement de l'étape. */
  onNext(): void {
    const results: RankingEntry[] = this.orderedParticipants().map((p, i) => ({
      participantId: p.id,
      rank: i + 1,
    }));
    this.next.emit(results);
  }

  onBack(): void {
    this.back.emit();
  }

  /** Émet l'événement d'annulation. */
  onCancel(): void {
    this.formCancel.emit();
  }
}
