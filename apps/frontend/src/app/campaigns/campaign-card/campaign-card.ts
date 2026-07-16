/**
 * Composant CampaignCard — affiche une seule saison en lecture.
 *
 * Composant "dumb" (cf. team-card.ts) : reçoit la saison via input(),
 * n'effectue aucun appel HTTP. Pour l'US1, purement informatif — aucune
 * action n'est encore exposée (clic vers le détail de saison viendra avec
 * une US ultérieure).
 */
import { Component, InputSignal, Signal, computed, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Campaign } from '../campaign.model';
import { Icon } from '../../shared/icon/icon';

@Component({
  selector: 'app-campaign-card',
  standalone: true,
  imports: [RouterLink, NgTemplateOutlet, Icon],
  templateUrl: './campaign-card.html',
  styleUrl: './campaign-card.scss',
})
export class CampaignCard {
  /** La saison à afficher. */
  campaign: InputSignal<Campaign> = input.required<Campaign>();

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
