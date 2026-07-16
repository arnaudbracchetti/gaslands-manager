/**
 * SequellaDetailModal — popup de détail d'une séquelle, dumb.
 *
 * Ouverte par la carte séquelle d'`EquipmentManager` au clic (mirroir de
 * `EquipmentOption`/`EquipmentDetailModal` pour les 3 autres catégories) : présente
 * nom, coût en Chocs, description ET règles complètes. Composant dédié plutôt que
 * réutilisation d'`EquipmentDetailModal` — celui-ci suppose un coût en jerricans et
 * un emplacement, deux notions absentes d'une séquelle (monnaie Chocs, jamais
 * d'emplacement).
 *
 * Purement informative, même contrat que `EquipmentDetailModal` : la seule sortie est
 * `closed` ("Annuler" ou clic sur l'overlay) — l'achat reste l'action exclusive du
 * bouton "Acquérir" de la carte, non dupliqué ici.
 */
import { Component, InputSignal, OutputEmitterRef, input, output } from '@angular/core';
import { AvailableSequellaDto } from '../../../../campaigns/workshop.model';
import { Icon } from '../../../../shared/icon/icon';

@Component({
  selector: 'app-sequella-detail-modal',
  standalone: true,
  imports: [Icon],
  templateUrl: './sequella-detail-modal.html',
  styleUrl: './sequella-detail-modal.scss',
})
export class SequellaDetailModal {
  /** La séquelle à détailler — même DTO que la carte qui l'a ouverte. */
  sequella: InputSignal<AvailableSequellaDto> = input.required<AvailableSequellaDto>();

  /** Fermeture sans action — "Annuler" ou clic hors de la boîte. */
  closed: OutputEmitterRef<void> = output<void>();
}
