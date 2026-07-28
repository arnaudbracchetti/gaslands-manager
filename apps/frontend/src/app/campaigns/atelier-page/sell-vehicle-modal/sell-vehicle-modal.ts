/**
 * SellVehicleModal — fenêtre de synthèse avant vente/annulation d'un véhicule d'atelier.
 *
 * Composant dumb : reçoit une `VehicleSaleSummary` déjà calculée (`buildVehicleSaleSummary`,
 * `AtelierPage`) et émet le choix de l'utilisateur. Compose `ModalShell` (chrome Panel
 * métal + coins + HazardTape mutualisé, mode "action") — ne garde que son contenu
 * structuré propre (véhicule, liste d'équipement, totaux) comme contenu projeté.
 *
 * Texte et libellé du bouton de confirmation discriminés par `summary.purchasedThisSession` :
 * "Annuler l'achat" (remboursement intégral, véhicule acheté cette session) vs "Vendre"
 * (remboursement par élément, `summary.refund` — valeur backend, jamais recalculée ici).
 */
import { Component, InputSignal, OutputEmitterRef, Signal, computed, input, output } from '@angular/core';
import { VehicleSaleSummary } from '../vehicle-sale-summary';
import { Icon } from '../../../shared/icon/icon';
import { ModalShell } from '../../../shared/modal-shell/modal-shell';

@Component({
  selector: 'app-sell-vehicle-modal',
  standalone: true,
  imports: [Icon, ModalShell],
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
