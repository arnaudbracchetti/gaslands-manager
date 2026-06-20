/**
 * Composant TeamCard — affiche une seule équipe Gaslands en lecture.
 *
 * Composant "dumb" : reçoit les données via input() et signale les actions
 * via output(). Ne connaît pas les services, ne fait pas de requêtes HTTP.
 *
 * Cliquer n'importe où sur la carte émet `cardClicked` → le parent navigue
 * vers `/teams/:id/edit` (hub complet de gestion de l'équipe).
 */
import { Component, InputSignal, OutputEmitterRef, Signal, computed, input, output } from '@angular/core';
import { Team } from '../team.model';
import { VehicleSummary } from '../vehicle-summary';

@Component({
  selector: 'app-team-card',
  standalone: true,
  imports: [],
  templateUrl: './team-card.html',
  styleUrl: './team-card.scss',
})
export class TeamCard {
  /** L'équipe à afficher. */
  team: InputSignal<Team> = input.required<Team>();

  /**
   * Résumés des véhicules de l'équipe — nom, coût, emplacements utilisés/total.
   * `[]` par défaut : équipe sans véhicule ou résumé pas encore chargé.
   */
  vehicles: InputSignal<VehicleSummary[]> = input<VehicleSummary[]>([]);

  /**
   * Somme des coûts de tous les véhicules — comparée au budget de l'équipe.
   * Calculé localement depuis `vehicles()` : fonction pure, pas d'appel HTTP.
   */
  coutVehiclesTotal: Signal<number> = computed(() =>
    this.vehicles().reduce((sum, v) => sum + v.cout, 0),
  );

  /**
   * Émis quand l'utilisateur clique sur la carte.
   * Le parent navigue vers `/teams/:id/edit`.
   */
  cardClicked: OutputEmitterRef<Team> = output<Team>();
}
