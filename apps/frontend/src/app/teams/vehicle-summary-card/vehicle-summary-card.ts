/**
 * VehicleSummaryCard — carte dumb affichant le résumé d'un véhicule d'équipe.
 *
 * Composant de présentation extrait de `TeamEditPage` pour en réduire le budget CSS.
 * Reçoit un `VehicleSummary` en entrée et émet deux événements : "gérer" et "supprimer".
 */
import { Component, input, output } from '@angular/core';
import { SlicePipe, UpperCasePipe } from '@angular/common';
import { VehicleSummary } from '../vehicle-summary';
import { SlotGauge } from '../../shared/slot-gauge/slot-gauge';

@Component({
  selector: 'app-vehicle-summary-card',
  standalone: true,
  imports: [SlicePipe, UpperCasePipe, SlotGauge],
  templateUrl: './vehicle-summary-card.html',
  styleUrl: './vehicle-summary-card.scss',
})
export class VehicleSummaryCard {
  vehicle = input.required<VehicleSummary>();

  /** Émet l'id du véhicule — le parent navigue vers la page d'équipement. */
  manageClicked = output<number>();

  /** Émet le VehicleSummary complet — le parent a besoin du nom pour la confirmation. */
  deleteClicked = output<VehicleSummary>();
}
