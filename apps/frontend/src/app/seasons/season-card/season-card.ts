/**
 * Composant SeasonCard — affiche une seule saison en lecture.
 *
 * Composant "dumb" (cf. team-card.ts) : reçoit la saison via input(),
 * n'effectue aucun appel HTTP. Pour l'US1, purement informatif — aucune
 * action n'est encore exposée (clic vers le détail de saison viendra avec
 * une US ultérieure).
 */
import { Component, InputSignal, input } from '@angular/core';
import { Season } from '../season.model';
import { InviteLink } from '../invite-link/invite-link';

@Component({
  selector: 'app-season-card',
  standalone: true,
  imports: [InviteLink],
  templateUrl: './season-card.html',
  styleUrl: './season-card.scss',
})
export class SeasonCard {
  /** La saison à afficher. */
  season: InputSignal<Season> = input.required<Season>();
}
