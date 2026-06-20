/**
 * SlotGauge — jauge visuelle d'emplacements d'un véhicule.
 *
 * Composant "dumb" générique : reçoit le nombre d'emplacements utilisés et le
 * total, affiche autant de petits carrés que d'emplacements — pleins pour les
 * occupés, vides pour les libres. Un tooltip natif explicite les valeurs au survol.
 *
 * Usage :
 *   <app-slot-gauge [used]="vehicle.emplacementsUtilises" [total]="vehicle.emplacementsTotal" />
 *   <app-slot-gauge [used]="2" [total]="4" size="md" />
 *
 * Tailles disponibles (défaut : 'sm') :
 *   sm — 10×10 px  (cartes d'équipe, listes compactes)
 *   md — 13×13 px  (récapitulatif du configurateur)
 *   lg — 16×16 px  (affichage proéminent)
 */
import { Component, InputSignal, input } from '@angular/core';

export type SlotGaugeSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-slot-gauge',
  standalone: true,
  templateUrl: './slot-gauge.html',
  styleUrl: './slot-gauge.scss',
})
export class SlotGauge {
  /** Nombre d'emplacements actuellement occupés (armes + améliorations). */
  used: InputSignal<number> = input.required<number>();

  /** Capacité totale d'emplacements du véhicule. */
  total: InputSignal<number> = input.required<number>();

  /**
   * Taille des carrés — pilote une classe BEM modificatrice sur le conteneur.
   * Défaut : 'sm' (taille compacte adaptée aux listes).
   */
  size: InputSignal<SlotGaugeSize> = input<SlotGaugeSize>('sm');

  /**
   * Génère un tableau d'indices [0, 1, …, total - 1] pour que le @for du
   * template puisse itérer et colorier chaque carré d'emplacement.
   */
  slotsArray(): number[] {
    return Array.from({ length: this.total() }, (_, i) => i);
  }
}
