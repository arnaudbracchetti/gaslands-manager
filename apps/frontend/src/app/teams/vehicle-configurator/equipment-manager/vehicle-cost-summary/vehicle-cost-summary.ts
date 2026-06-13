/**
 * VehicleCostSummary — composant "dumb" affichant le nom du véhicule, ses
 * emplacements (utilisés/total) et le détail de son coût (Base / + Équipement
 * / Total).
 *
 * Extrait d'`EquipmentManager` (en-tête de `.em-current`) — purement
 * présentationnel, mirroir de `TeamBudget`.
 *
 * Nom choisi pour ne pas entrer en collision avec l'interface `VehicleSummary`
 * (`apps/frontend/src/app/teams/vehicle-summary.ts`, résumé d'un véhicule sur
 * la carte d'équipe — concept différent : ce composant-ci ne porte que le
 * récapitulatif d'UN véhicule, déjà résolu par `EquipmentManager`).
 */
import { Component, InputSignal, input } from '@angular/core';

@Component({
  selector: 'app-vehicle-cost-summary',
  standalone: true,
  templateUrl: './vehicle-cost-summary.html',
  styleUrl: './vehicle-cost-summary.scss',
})
export class VehicleCostSummary {
  /** Nom AFFICHÉ du véhicule — déjà résolu par le parent (`chosenVehicule()?.nom ?? vehicle().nomInterne`). */
  vehicleName: InputSignal<string> = input.required<string>();

  /** Emplacements actuellement consommés (pool partagé armes + améliorations). */
  emplacementsUtilises: InputSignal<number> = input.required<number>();

  /** Capacité totale du véhicule, résolue depuis le catalogue. */
  emplacementsTotal: InputSignal<number> = input.required<number>();

  /** Prix de base du véhicule (catalogue). */
  coutBase: InputSignal<number> = input.required<number>();

  /** Somme des prix effectifs des armes et améliorations montées. */
  coutEquipement: InputSignal<number> = input.required<number>();

  /** Coût total du véhicule — base + équipement monté. */
  coutTotal: InputSignal<number> = input.required<number>();
}
