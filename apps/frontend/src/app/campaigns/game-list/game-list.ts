/**
 * Composant GameList — affiche le Programme Télé d'une saison.
 *
 * Composant "dumb" (cf. participant-list.ts) : reçoit les parties et un drapeau
 * `canManage` (organisateur ET saison EN_COURS), émet les actions d'édition et
 * de suppression. N'affiche les boutons que pour les parties encore PLANIFIE :
 * une partie JOUE est figée.
 *
 * Réordonnancement (US-A4) — même idiome que `RankingStep` (glisser-déposer
 * Angular CDK + flèches ▲▼), mais restreint aux parties encore PLANIFIE : une
 * partie ATELIER/JOUE n'est ni draggable (`cdkDragDisabled`) ni un point de
 * chute valide (`sortPredicate`, qui refuse tout index actuellement occupé par
 * une partie non-PLANIFIE) — sa position dans la liste ne bouge donc jamais.
 * `orderedGames`, copie locale réordonnable de `games()`, suit le même pattern
 * `effect()` que `RankingStep.orderedParticipants` : réinitialisée à chaque
 * changement de l'input (ex. rechargement après confirmation serveur).
 */
import {
  Component,
  InputSignal,
  OutputEmitterRef,
  WritableSignal,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDropList,
  DragDropModule,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { Game } from '../game.model';
import { Icon } from '../../shared/icon/icon';

@Component({
  selector: 'app-game-list',
  standalone: true,
  imports: [Icon, DatePipe, DragDropModule],
  templateUrl: './game-list.html',
  styleUrl: './game-list.scss',
})
export class GameList {
  // ── Inputs ──────────────────────────────────────────────────────────────────

  /** Parties du programme, déjà triées par le backend. */
  games: InputSignal<Game[]> = input.required<Game[]>();

  /** Vrai si l'utilisateur peut gérer le programme (organisateur + EN_COURS). */
  canManage: InputSignal<boolean> = input(false);

  /** Vrai si l'utilisateur peut saisir les rangs d'une partie. */
  canRecord: InputSignal<boolean> = input(false);

  // ── Outputs ─────────────────────────────────────────────────────────────────

  editGame: OutputEmitterRef<Game> = output<Game>();
  deleteGame: OutputEmitterRef<Game> = output<Game>();
  recordGame: OutputEmitterRef<Game> = output<Game>();
  openJournal: OutputEmitterRef<Game> = output<Game>();
  openAtelier: OutputEmitterRef<Game> = output<Game>();

  /**
   * Émis avec les ids des parties PLANIFIE dans leur nouvel ordre relatif
   * (jamais les ids des parties ATELIER/JOUE, jamais touchées) — le parent
   * (CampaignProgram) appelle `CampaignsService.reorderGames` puis recharge.
   */
  reorderRequested: OutputEmitterRef<number[]> = output<number[]>();

  // ── État interne ─────────────────────────────────────────────────────────────

  /** Copie réordonnable de `games()` — réinitialisée à chaque changement de l'input. */
  orderedGames: WritableSignal<Game[]> = signal<Game[]>([]);

  constructor() {
    effect(() => {
      this.orderedGames.set([...this.games()]);
    });
  }

  /** Vrai si la partie peut être éditée/supprimée/réordonnée (gérable et pas encore jouée). */
  canModify(game: Game): boolean {
    return this.canManage() && game.status === 'PLANIFIE';
  }

  /**
   * Vrai si le journal de la partie peut être consulté — dès que la partie a
   * commencé à générer des événements (ATELIER ou JOUE), visible par tout
   * participant (pas conditionné par canManage/canRecord).
   */
  hasJournal(game: Game): boolean {
    return game.status === 'ATELIER' || game.status === 'JOUE';
  }

  /**
   * Vrai si la partie est en phase atelier — un atelier est ouvert, tout
   * participant peut aller gérer l'équipement de son équipe (sa propre cagnotte).
   */
  isAtelier(game: Game): boolean {
    return game.status === 'ATELIER';
  }

  /** Libellé lisible du type de partie. */
  typeLabel(game: Game): string {
    return game.type === 'EVENEMENT_TELE' ? 'Événement Télévisé' : 'Escarmouche';
  }

  /** Libellé lisible du statut. */
  statusLabel(game: Game): string {
    switch (game.status) {
      case 'JOUE': return 'Jouée';
      case 'ATELIER': return 'Atelier';
      case 'PLANIFIE': return 'Planifiée';
    }
  }

  /** Émet l'event recordGame avec la partie. */
  onRecord(game: Game): void {
    this.recordGame.emit(game);
  }

  // ── Réordonnancement (US-A4) ─────────────────────────────────────────────────

  /**
   * Empêche une partie ATELIER/JOUE de servir de point de chute pendant un
   * glisser — sa position dans `drop.data` ne change donc jamais, seules les
   * parties PLANIFIE se permutent entre elles (leurs propres index restant,
   * eux, toujours valides). `drop` est ici toujours `orderedGames()` lui-même
   * (lié via `[cdkDropListData]`).
   */
  sortPredicate: (index: number, drag: CdkDrag<Game>, drop: CdkDropList<Game[]>) => boolean = (
    index: number,
    _drag: CdkDrag<Game>,
    drop: CdkDropList<Game[]>,
  ): boolean => drop.data[index]?.status === 'PLANIFIE';

  /** Callback CDK Drag-and-Drop : met à jour l'ordre après un glisser. */
  drop(event: CdkDragDrop<Game[]>): void {
    const list = [...this.orderedGames()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.applyReorder(list);
  }

  /** Fait remonter la partie d'un rang, jusqu'à la précédente partie PLANIFIE (saute les autres). */
  moveUp(gameId: number): void {
    const list = this.orderedGames();
    const index = list.findIndex((g) => g.id === gameId);
    const target = this.previousPlanifieIndex(list, index);
    if (index < 0 || target < 0) return;
    this.applyReorder(this.swap(list, index, target));
  }

  /** Fait descendre la partie d'un rang, jusqu'à la prochaine partie PLANIFIE (saute les autres). */
  moveDown(gameId: number): void {
    const list = this.orderedGames();
    const index = list.findIndex((g) => g.id === gameId);
    const target = this.nextPlanifieIndex(list, index);
    if (index < 0 || target < 0) return;
    this.applyReorder(this.swap(list, index, target));
  }

  /** Vrai si une autre partie PLANIFIE précède celle-ci — pilote la désactivation de ▲. */
  hasPreviousPlanifie(gameId: number): boolean {
    const list = this.orderedGames();
    return this.previousPlanifieIndex(list, list.findIndex((g) => g.id === gameId)) >= 0;
  }

  /** Vrai si une autre partie PLANIFIE suit celle-ci — pilote la désactivation de ▼. */
  hasNextPlanifie(gameId: number): boolean {
    const list = this.orderedGames();
    return this.nextPlanifieIndex(list, list.findIndex((g) => g.id === gameId)) >= 0;
  }

  private previousPlanifieIndex(list: Game[], fromIndex: number): number {
    for (let i = fromIndex - 1; i >= 0; i--) {
      if (list[i].status === 'PLANIFIE') return i;
    }
    return -1;
  }

  private nextPlanifieIndex(list: Game[], fromIndex: number): number {
    for (let i = fromIndex + 1; i < list.length; i++) {
      if (list[i].status === 'PLANIFIE') return i;
    }
    return -1;
  }

  private swap(list: Game[], i: number, j: number): Game[] {
    const copy = [...list];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    return copy;
  }

  /**
   * Met à jour l'affichage local puis émet les ids PLANIFIE dans leur nouvel
   * ordre relatif — filtrer ici, plutôt que dans le parent, garantit que
   * l'output ne porte jamais un id de partie ATELIER/JOUE, quelle que soit la
   * façon dont `list` a été obtenue (drag ou flèche).
   */
  private applyReorder(list: Game[]): void {
    this.orderedGames.set(list);
    this.reorderRequested.emit(list.filter((g) => g.status === 'PLANIFIE').map((g) => g.id));
  }
}
