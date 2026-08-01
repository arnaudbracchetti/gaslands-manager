/**
 * VehicleChoiceCard — carte de présentation d'un véhicule du catalogue (dumb).
 *
 * Étape 1 du `VehicleBuilder` : affiche un `Vehicule` (catalogue, déjà filtré
 * par sponsor — cf. `Sponsor.vehicules`) avec ses statistiques essentielles et
 * un bouton de sélection. Composant "dumb" au sens de l'ARCHITECTURE.md §2.5 :
 * il ne sait ni créer le véhicule, ni appeler l'API — il se contente d'afficher
 * et de signaler un choix via `output()`. C'est `VehicleBuilder` qui orchestre
 * la persistance immédiate (`vehicleService.create`, cf. plan "Décisions actées").
 *
 * Mirroir du découpage `TeamCard` (cf. son en-tête) : un composant par élément
 * de liste, réutilisable et testable indépendamment.
 */
import { Component, InputSignal, OutputEmitterRef, Signal, computed, input, output } from '@angular/core';
import { Vehicule } from '../../../catalog/catalog.model';
import { SlotGauge } from '../../../shared/slot-gauge/slot-gauge';
import { Icon } from '../../../shared/icon/icon';

@Component({
  selector: 'app-vehicle-choice-card',
  standalone: true,
  imports: [SlotGauge, Icon],
  templateUrl: './vehicle-choice-card.html',
  styleUrl: './vehicle-choice-card.scss',
})
export class VehicleChoiceCard {
  /**
   * Le véhicule du catalogue à présenter.
   * input.required<T>() : `VehicleBuilder` itère sur `sponsorCatalog().vehicules`
   * — toujours fourni, jamais de valeur par défaut pertinente (cf. TeamCard.team).
   */
  vehicule: InputSignal<Vehicule> = input.required<Vehicule>();

  /** Position dans la liste (1-based) — affichée en filigrane. */
  index: InputSignal<number> = input<number>(1);

  /**
   * Verdict de disponibilité budgétaire (`GetAvailableVehiclesUseCase`/
   * `GetWorkshopAvailableVehiclesUseCase`, `Team.canAddVehicle`). `true` par défaut :
   * un consommateur qui ne fournit pas ce verdict garde le comportement historique
   * (carte toujours cliquable) — cf. `equipment-option.html`, même convention
   * `disponible`/`raison` que les armes/améliorations/avantages.
   */
  disponible: InputSignal<boolean> = input<boolean>(true);

  /** Raison du refus (backend, `RuleResult.reason`) — affichée à la place du bouton si `!disponible()`. */
  raison: InputSignal<string | undefined> = input<string | undefined>(undefined);

  /**
   * Émis quand l'utilisateur choisit ce véhicule.
   * Le parent déclenche alors `vehicleService.create()` — persistance immédiate
   * (cf. plan, "Décisions actées" : un véhicule "nu" reste un véhicule valide).
   * Défense en profondeur : n'émet jamais si `!disponible()` — le backend reste
   * la seule source de vérité (il refuserait de toute façon la création).
   */
  chosen: OutputEmitterRef<Vehicule> = output<Vehicule>();

  onChoose(): void {
    if (!this.disponible()) return;
    this.chosen.emit(this.vehicule());
  }

  /** Numéro formaté sur 2 chiffres pour le filigrane : 1 → "01". */
  indexFormate: Signal<string> = computed(() =>
    String(this.index()).padStart(2, '0'),
  );
}
