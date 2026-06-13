/**
 * EquipmentDetailModal — popup de détail d'un équipement (arme ou amélioration), dumb.
 *
 * Ouverte par `EquipmentOption` au clic sur la carte (cf. son en-tête) : présente
 * toutes les informations du catalogue pour cet équipement — nom, coût, emplacement,
 * description ET règles complètes (`regles`, absent de la carte pour la garder
 * compacte, cf. `vehicle-builder.model.ts`) — dans une mise en page aérée.
 *
 * Composant **dumb**, même pattern que `TourelleAssignmentModal` (overlay plein
 * écran + boîte centrale, `role="dialog"`/`aria-modal`, cf.
 * `equipment-manager/tourelle-assignment-modal/`). Deux sorties :
 *  - `closed` : "Annuler" OU clic sur l'overlay (en dehors de la boîte) — le
 *    parent referme la popup sans action.
 *  - `addClicked` : bouton "Ajouter" — le parent déclenche exactement le même
 *    flux que le bouton "+" de la carte (`EquipmentOption.onAddClicked`), PUIS
 *    referme la popup. Masqué si l'équipement n'est pas ajoutable (refus
 *    définitif — cf. `EquipmentOption`, "DEUX nuances de raison").
 */
import { Component, InputSignal, OutputEmitterRef, input, output } from '@angular/core';
import { EquipmentOption as EquipmentOptionDto } from '../../vehicle-builder.model';

@Component({
  selector: 'app-equipment-detail-modal',
  standalone: true,
  imports: [],
  templateUrl: './equipment-detail-modal.html',
  styleUrl: './equipment-detail-modal.scss',
})
export class EquipmentDetailModal {
  /** L'entrée de catalogue à détailler — même DTO que la carte qui l'a ouverte. */
  option: InputSignal<EquipmentOptionDto> = input.required<EquipmentOptionDto>();

  /**
   * Cf. doc de `EquipmentOption.requiresOrientation` — pilote l'affichage du
   * bouton "Ajouter" exactement comme sur la carte (équipement orientable
   * `disponible: false` ⇒ "il manque une information", pas un refus).
   */
  requiresOrientation: InputSignal<boolean> = input<boolean>(false);

  /** Fermeture sans action — "Annuler" ou clic hors de la boîte. */
  closed: OutputEmitterRef<void> = output<void>();

  /** "Ajouter" — le parent gère le flux complet (orientation éventuelle) puis referme. */
  addClicked: OutputEmitterRef<void> = output<void>();
}
