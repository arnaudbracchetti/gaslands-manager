/**
 * Composant SeasonCard — affiche une seule saison en lecture.
 *
 * Composant "dumb" (cf. team-card.ts) : reçoit la saison via input(),
 * n'effectue aucun appel HTTP. Pour l'US1, purement informatif — aucune
 * action n'est encore exposée (clic vers le détail de saison viendra avec
 * une US ultérieure).
 */
import { Component, InputSignal, Signal, computed, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Season } from '../season.model';

@Component({
  selector: 'app-season-card',
  standalone: true,
  imports: [RouterLink, NgTemplateOutlet],
  templateUrl: './season-card.html',
  styleUrl: './season-card.scss',
})
export class SeasonCard {
  /** La saison à afficher. */
  season: InputSignal<Season> = input.required<Season>();

  /** Position dans la liste (1-based) — affichée en filigrane. */
  index: InputSignal<number> = input<number>(1);

  /** Vrai si l'utilisateur a une demande d'inscription PENDING pour cette saison (US4) */
  isPending: InputSignal<boolean> = input(false);

  /** Nombre de demandes d'inscription PENDING à valider, si organisateur (US4) */
  pendingRequestsCount: InputSignal<number> = input(0);

  /** Numéro formaté sur 2 chiffres pour le filigrane : 1 → "01". */
  indexFormate: Signal<string> = computed(() =>
    String(this.index()).padStart(2, '0'),
  );
}
