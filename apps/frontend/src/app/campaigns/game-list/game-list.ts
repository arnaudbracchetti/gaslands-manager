/**
 * Composant GameList — affiche le Programme Télé d'une saison.
 *
 * Composant "dumb" (cf. participant-list.ts) : reçoit les parties et un drapeau
 * `canManage` (organisateur ET saison EN_COURS), émet les actions d'édition et
 * de suppression. N'affiche les boutons que pour les parties encore PLANIFIE :
 * une partie JOUE est figée.
 */
import {
  Component,
  InputSignal,
  OutputEmitterRef,
  input,
  output,
} from '@angular/core';
import { Game } from '../game.model';
import { Icon } from '../../shared/icon/icon';

@Component({
  selector: 'app-game-list',
  standalone: true,
  imports: [Icon],
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

  /** Vrai si la partie peut être éditée/supprimée (gérable et pas encore jouée). */
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
}
