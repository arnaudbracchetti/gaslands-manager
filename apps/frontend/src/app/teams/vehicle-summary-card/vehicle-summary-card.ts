/**
 * VehicleSummaryCard — carte dumb affichant le résumé d'un véhicule d'équipe.
 *
 * Composant de présentation extrait de `TeamEditPage` pour en réduire le budget CSS.
 * Reçoit un `VehicleSummary` en entrée. Toute la carte est cliquable (`cardClicked`,
 * même pattern que `TeamCard`/`CampaignCard`) — l'action déclenchée dépend de l'écran
 * appelant (gérer l'équipement, sélectionner pour consultation…). Le bouton
 * supprimer/vendre reste une action séparée (`deleteClicked`).
 */
import { Component, InputSignal, OutputEmitterRef, Signal, computed, input, output } from '@angular/core';
import { SlicePipe, UpperCasePipe } from '@angular/common';
import { VehicleSummary } from '../vehicle-summary';
import { SlotGauge } from '../../shared/slot-gauge/slot-gauge';
import { Icon } from '../../shared/icon/icon';
import { IconConcept } from '../../shared/icon/icon-sheet.map';

@Component({
  selector: 'app-vehicle-summary-card',
  standalone: true,
  imports: [SlicePipe, UpperCasePipe, SlotGauge, Icon],
  templateUrl: './vehicle-summary-card.html',
  styleUrl: './vehicle-summary-card.scss',
})
export class VehicleSummaryCard {
  vehicle: InputSignal<VehicleSummary> = input.required<VehicleSummary>();

  /** Position dans la liste (1-based) — affichée en filigrane. */
  index: InputSignal<number> = input<number>(1);

  /** Affiche le bouton de suppression/vente. */
  showDelete: InputSignal<boolean> = input<boolean>(true);

  /** Surbrillance "sélectionné" — utilisé par la vue maître-détail en lecture seule
   *  (`ParticipantAtelierPage`) pour indiquer le véhicule actuellement consulté. */
  selected: InputSignal<boolean> = input<boolean>(false);

  /** Titre (tooltip) du bouton — "Supprimer ce véhicule" par défaut (construction d'équipe),
   *  adapté par l'atelier ("Vendre ce véhicule"/"Annuler l'achat"). */
  deleteTitle: InputSignal<string> = input<string>('Supprimer ce véhicule');

  /** Icône du bouton — `supprimer` (poubelle) par défaut, adaptée par l'atelier
   *  (ex. `argent` pour une vente). */
  deleteIconConcept: InputSignal<IconConcept | null> = input<IconConcept | null>('supprimer');

  /** Texte brut utilisé UNIQUEMENT si `deleteIconConcept` est `null` — seul cas
   *  restant : annulation d'achat en atelier (↩️, aucune icône peinte correspondante). */
  deleteIconFallback: InputSignal<string> = input<string>('');

  /** Numéro formaté sur 2 chiffres pour le filigrane : 1 → "01". */
  indexFormate: Signal<string> = computed(() =>
    String(this.index()).padStart(2, '0'),
  );

  /** Émet l'id du véhicule au clic sur la carte — le parent décide de l'action
   *  (naviguer vers la page d'équipement, sélectionner pour consultation…). */
  cardClicked: OutputEmitterRef<number> = output<number>();

  /** Émet le VehicleSummary complet — le parent a besoin du nom pour la confirmation. */
  deleteClicked: OutputEmitterRef<VehicleSummary> = output<VehicleSummary>();
}
