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

@Component({
  selector: 'app-game-list',
  standalone: true,
  imports: [],
  templateUrl: './game-list.html',
  styleUrl: './game-list.scss',
})
export class GameList {
  // ── Inputs ──────────────────────────────────────────────────────────────────

  /** Parties du programme, déjà triées par le backend. */
  games: InputSignal<Game[]> = input.required<Game[]>();

  /** Vrai si l'utilisateur peut gérer le programme (organisateur + EN_COURS). */
  canManage: InputSignal<boolean> = input(false);

  // ── Outputs ─────────────────────────────────────────────────────────────────

  editGame: OutputEmitterRef<Game> = output<Game>();
  deleteGame: OutputEmitterRef<Game> = output<Game>();

  /** Vrai si la partie peut être éditée/supprimée (gérable et pas encore jouée). */
  canModify(game: Game): boolean {
    return this.canManage() && game.status === 'PLANIFIE';
  }

  /** Libellé lisible du type de partie. */
  typeLabel(game: Game): string {
    return game.type === 'EVENEMENT_TELE' ? 'Événement Télévisé' : 'Escarmouche';
  }

  /** Libellé lisible du statut. */
  statusLabel(game: Game): string {
    return game.status === 'JOUE' ? 'Jouée' : 'Planifiée';
  }
}
