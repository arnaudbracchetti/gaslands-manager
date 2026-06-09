/**
 * TourelleAssignmentModal — modale de sélection d'arme pour une Tourelle orpheline.
 *
 * Composant **dumb** : il reçoit la liste filtrée des armes posables sur la
 * Tourelle (calculée par `EquipmentManager.armesPourTourelle`) et émet soit
 * le `nomInterne` de l'arme choisie, soit `cancelled`. Il ne sait rien de
 * l'état global d'`EquipmentManager` — ni quel véhicule, ni quelle Tourelle
 * est en cours d'assignation.
 *
 * La visibilité est contrôlée par le parent via `@if (selectedOrphanTourelle())`
 * dans `equipment-manager.html` — ce composant s'affiche toujours quand il est
 * instancié (pattern cohérent avec `EquipmentOption` et `VehicleChoiceCard`).
 *
 * Prix affiché : 3 × le prix de l'arme (coût total Tourelle incluse) — règle
 * documentée dans SPECIFICATION.md §7 "Améliorations de véhicule", colonne Coût.
 */
import { Component, InputSignal, OutputEmitterRef, input, output } from '@angular/core';
import type { Arme } from '../../../../catalog/catalog.model';

@Component({
  selector: 'app-tourelle-assignment-modal',
  standalone: true,
  imports: [],
  templateUrl: './tourelle-assignment-modal.html',
  styleUrl: './tourelle-assignment-modal.scss',
})
export class TourelleAssignmentModal {
  /**
   * Armes disponibles pour montage sur la Tourelle — déjà filtrées par le parent
   * (type `équipage` exclus, slots restants respectés, cf. `armesPourTourelle`
   * dans `EquipmentManager`). Ce composant n'applique aucun filtre supplémentaire.
   */
  armes: InputSignal<Arme[]> = input.required<Arme[]>();

  /** Arme choisie — émet le `nom_interne` de l'arme sélectionnée. */
  weaponChosen: OutputEmitterRef<string> = output<string>();

  /** Fermeture sans sélection — le parent remet `selectedOrphanTourelle` à `null`. */
  cancelled: OutputEmitterRef<void> = output<void>();
}
