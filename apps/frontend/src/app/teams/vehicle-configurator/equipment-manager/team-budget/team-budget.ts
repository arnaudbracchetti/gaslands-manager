/**
 * TeamBudget — composant "dumb" affichant le bloc "Budget de l'équipe"
 * (barre de progression + solde restant/dépassement).
 *
 * Extrait d'`EquipmentManager` (cf. son en-tête, "Budget de l'équipe (computed)") —
 * purement présentationnel : reçoit les 5 valeurs déjà calculées par les
 * `computed()` du parent et se contente de les afficher. Aucune injection de
 * service, aucun output — mirroir de `TeamCard`/`VehicleChoiceCard` (dossier
 * plat, `input.required<T>()`).
 */
import { Component, InputSignal, input } from '@angular/core';

@Component({
  selector: 'app-team-budget',
  standalone: true,
  templateUrl: './team-budget.html',
  styleUrl: './team-budget.scss',
})
export class TeamBudget {
  /** Budget total de l'équipe (jerricans) — `Team.cans`. */
  budgetEquipe: InputSignal<number> = input.required<number>();

  /** Coût cumulé de TOUS les véhicules de l'équipe, CE véhicule inclus. */
  coutEquipeTotal: InputSignal<number> = input.required<number>();

  /** Solde restant — peut être négatif (cf. `budgetDepasse`). */
  budgetRestant: InputSignal<number> = input.required<number>();

  /** `true` si le coût cumulé dépasse le budget (filet de sécurité d'affichage). */
  budgetDepasse: InputSignal<boolean> = input.required<boolean>();

  /** Pourcentage du budget consommé — borné à 100% pour la barre de progression. */
  budgetPourcentage: InputSignal<number> = input.required<number>();
}
