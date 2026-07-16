/**
 * SellVehicleModal — fenêtre de synthèse avant vente/annulation d'un véhicule d'atelier.
 *
 * Composant dumb : reçoit une `VehicleSaleSummary` déjà calculée (`buildVehicleSaleSummary`,
 * `AtelierPage`) et émet le choix de l'utilisateur. Reprend le style visuel de `ConfirmModal`
 * (Panel métal + bande HazardTape) mais dupliqué plutôt que projeté en `ng-content` générique :
 * seul cet écran a besoin d'un contenu structuré (liste d'équipement + totaux), les 4 autres
 * consommateurs de `ConfirmModal` n'en ont pas besoin.
 *
 * Texte et libellé du bouton de confirmation discriminés par `summary.purchasedThisSession` :
 * "Annuler l'achat" (remboursement intégral, véhicule acheté cette session) vs "Vendre"
 * (remboursement par élément, `summary.refund` — valeur backend, jamais recalculée ici).
 */
import { Component, InputSignal, OutputEmitterRef, Signal, computed, input, output } from '@angular/core';
import { VehicleSaleSummary } from '../vehicle-sale-summary';
import { Icon } from '../../../shared/icon/icon';

@Component({
  selector: 'app-sell-vehicle-modal',
  standalone: true,
  imports: [Icon],
  templateUrl: './sell-vehicle-modal.html',
  styleUrl: './sell-vehicle-modal.scss',
})
export class SellVehicleModal {
  summary: InputSignal<VehicleSaleSummary> = input.required<VehicleSaleSummary>();

  /** Émis quand l'utilisateur confirme (vente réelle ou annulation d'achat). */
  confirmed: OutputEmitterRef<void> = output<void>();

  /** Émis quand l'utilisateur ferme sans agir. */
  cancelled: OutputEmitterRef<void> = output<void>();

  title: Signal<string> = computed((): string =>
    this.summary().purchasedThisSession ? "Annuler l'achat de ce véhicule ?" : 'Vendre ce véhicule ?',
  );

  confirmLabel: Signal<string> = computed((): string =>
    this.summary().purchasedThisSession ? "Annuler l'achat" : 'Vendre',
  );

  /** Montant affiché — intégral (tout dépensé cette session) pour une annulation, sinon le
   *  remboursement par élément fourni par le backend. */
  amount: Signal<number> = computed((): number =>
    this.summary().purchasedThisSession ? this.summary().totalCost : this.summary().refund,
  );
}
