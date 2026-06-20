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
import { SlotGauge } from '../../shared/slot-gauge/slot-gauge';

@Component({
  selector: 'app-team-card',
  standalone: true,
  imports: [SlotGauge],
  templateUrl: './team-card.html',
  styleUrl: './team-card.scss',
})
export class TeamCard {
  /** L'équipe à afficher. */
  team: InputSignal<Team> = input.required<Team>();

  /**
   * Position de l'équipe dans la liste (1-based) — affichée en filigrane.
   * Passé par le parent via `[index]="$index + 1"`.
   */
  index: InputSignal<number> = input<number>(1);

  /**
   * Résumés des véhicules de l'équipe — nom, coût, emplacements utilisés/total.
   * `[]` par défaut : équipe sans véhicule ou résumé pas encore chargé.
   */
  vehicles: InputSignal<VehicleSummary[]> = input<VehicleSummary[]>([]);

  /** Numéro formaté sur 2 chiffres pour le filigrane : 1 → "01". */
  indexFormate: Signal<string> = computed(() =>
    String(this.index()).padStart(2, '0'),
  );

  /** Somme des coûts de tous les véhicules. */
  coutVehiclesTotal: Signal<number> = computed(() =>
    this.vehicles().reduce((sum, v) => sum + v.cout, 0),
  );

  /** Budget restant (négatif si dépassé). */
  budgetRestant: Signal<number> = computed(() =>
    this.team().cans - this.coutVehiclesTotal(),
  );

  /** Vrai si le budget est dépassé. */
  budgetDepasse: Signal<boolean> = computed(() => this.budgetRestant() < 0);

  /** Pourcentage du budget consommé, plafonné à 100 pour la barre. */
  budgetPourcentage: Signal<number> = computed(() =>
    Math.min(100, Math.round((this.coutVehiclesTotal() / this.team().cans) * 100)),
  );

  /**
   * Message contextuel sous la barre de budget.
   * Catégories : dépassé / épuisé / critique (≤5 $) / disponible.
   */
  messageStatut: Signal<{ texte: string; niveau: 'over' | 'epuise' | 'critique' | 'ok' }> = computed(() => {
    const restant = this.budgetRestant();
    if (restant < 0) {
      return { texte: `BUDGET DÉPASSÉ — +${-restant} $`, niveau: 'over' };
    }
    if (restant === 0) {
      return { texte: 'Budget épuisé', niveau: 'epuise' };
    }
    if (restant <= 5) {
      return { texte: `${restant} $ RESTANT — CRITIQUE`, niveau: 'critique' };
    }
    return { texte: `${restant} $ DISPONIBLES`, niveau: 'ok' };
  });

  /**
   * Émis quand l'utilisateur clique sur la carte.
   * Le parent navigue vers `/teams/:id/edit`.
   */
  cardClicked: OutputEmitterRef<Team> = output<Team>();
}
