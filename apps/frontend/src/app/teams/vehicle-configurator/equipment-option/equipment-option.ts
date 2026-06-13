/**
 * EquipmentOption — ligne de catalogue d'équipement (arme OU amélioration), dumb.
 *
 * Étape 2 du `VehicleBuilder` : affiche UNE entrée du catalogue filtré (avec son
 * verdict de disponibilité — `disponible`/`raison`, calculé par le backend, cf.
 * `WeaponService.getAvailableWeapons`/`VehicleService.getAvailableImprovements`)
 * et gère le choix de l'orientation pour les équipements qui en ont besoin.
 *
 * Réutilisable pour armes ET améliorations : les deux DTOs (`AvailableWeaponDto`,
 * `AvailableImprovementDto`) sont structurellement compatibles avec `EquipmentOption`
 * (cf. `vehicle-builder.model.ts`, doc de cette interface) — un seul composant
 * suffit, pas de duplication entre les deux sous-étapes du builder.
 *
 * ⚠️ Point UX (cf. plan, "Point UX à respecter") : ne JAMAIS émettre `chosen`
 * pour un équipement orientable sans orientation choisie. Flux en deux temps :
 *   1. Clic sur "Ajouter" → si `requiresOrientation()`, affiche le sélecteur
 *      4 directions au lieu d'émettre directement
 *   2. Clic sur une direction → émet `{ nomInterne, orientation }`
 * Pour un équipement non-orientable (`requiresOrientation() === false`, ex: arme
 * d'équipage ou amélioration non-orientée), "Ajouter" émet directement `{ nomInterne }`.
 */
import { Component, InputSignal, OutputEmitterRef, WritableSignal, input, output, signal } from '@angular/core';
import { EquipmentChoice, EquipmentOption as EquipmentOptionDto, Orientation } from '../vehicle-builder.model';
import { EquipmentDetailModal } from './equipment-detail-modal/equipment-detail-modal';

@Component({
  selector: 'app-equipment-option',
  standalone: true,
  imports: [EquipmentDetailModal],
  templateUrl: './equipment-option.html',
  styleUrl: './equipment-option.scss',
})
export class EquipmentOption {
  /**
   * L'entrée de catalogue à présenter (avec son verdict de disponibilité).
   * Nommé `option` (et non `equipment`/`item`) pour rester court dans le template
   * — `EquipmentOptionDto` est un alias d'import pour éviter la collision de noms
   * avec la CLASSE du composant (les deux s'appellent `EquipmentOption`).
   */
  option: InputSignal<EquipmentOptionDto> = input.required<EquipmentOptionDto>();

  /**
   * Si true, cet équipement requiert une orientation avant l'ajout — affiche
   * le sélecteur 4 directions au lieu d'émettre directement (cf. en-tête).
   *
   * Calculé par `VehicleBuilder`, PAS ici : pour les armes via le champ typé
   * `AvailableWeaponDto.type` (`!== 'équipage'`) ; pour les améliorations,
   * aucun champ typé n'existe — `VehicleBuilder` s'appuie sur le contrat textuel
   * documenté par le backend (`raison` = "Une orientation est requise pour…",
   * cf. `VehicleService.getAvailableImprovements`, "Note de conception").
   * `EquipmentOption` n'a pas à connaître cette mécanique, juste à l'appliquer.
   *
   * ⚠️ Conséquence d'affichage à connaître : un équipement orientable revient
   * SYSTÉMATIQUEMENT du backend avec `disponible: false` tant qu'aucune
   * orientation n'a été choisie (cf. doc citée — "il manque une information",
   * pas "c'est interdit"). Le template traite donc `disponible || requiresOrientation`
   * comme le signal "proposer l'ajout", et réserve l'affichage de `raison` aux
   * refus définitifs (`!disponible && !requiresOrientation`) — cf. `equipment-option.html`.
   */
  requiresOrientation: InputSignal<boolean> = input<boolean>(false);

  /**
   * Émis quand l'utilisateur confirme l'ajout — directement pour un équipement
   * non-orientable, après choix de la direction sinon. Miroir exact du corps
   * attendu par `addWeapon`/`addImprovement` (cf. `EquipmentChoice`, doc).
   */
  chosen: OutputEmitterRef<EquipmentChoice> = output<EquipmentChoice>();

  /**
   * Affiche le sélecteur d'orientation (état local, purement UI — ne sort jamais
   * de ce composant). `false` : ligne "au repos" ; `true` : 4 boutons de direction
   * + "Annuler" remplacent le bouton "Ajouter".
   */
  choosingOrientation: WritableSignal<boolean> = signal(false);

  /** Les 4 arcs de tir standard de Gaslands (cf. `Orientation`, SPECIFICATION.md §5). */
  readonly orientations: readonly Orientation[] = ['avant', 'arrière', 'gauche', 'droite'];

  /**
   * Affiche la popup de détail (`EquipmentDetailModal`) — état local, purement UI.
   * Ouverte au clic sur la carte (cf. `openDetails`), fermée par "Annuler", un
   * clic en dehors de la popup, ou "Ajouter" (qui referme ET déclenche l'ajout).
   */
  detailsOpen: WritableSignal<boolean> = signal(false);

  /**
   * Clic sur la carte : ouvre la popup de détail. Ignoré pendant le choix
   * d'orientation (`choosingOrientation()`) — la carte est alors occupée par
   * le sélecteur 4 directions, pas par une zone "voir le détail". Les boutons
   * internes (+, orientations, Annuler) appellent `$event.stopPropagation()`
   * dans le template pour ne pas déclencher cette ouverture.
   */
  openDetails(): void {
    if (this.choosingOrientation()) {
      return;
    }
    this.detailsOpen.set(true);
  }

  /** Ferme la popup sans action — "Annuler" ou clic en dehors (cf. `EquipmentDetailModal`). */
  closeDetails(): void {
    this.detailsOpen.set(false);
  }

  /**
   * "Ajouter" depuis la popup de détail : referme la popup puis délègue à
   * `onAddClicked` — flux IDENTIQUE au bouton "+" de la carte (sélecteur
   * d'orientation si nécessaire, émission directe sinon).
   */
  onModalAddClicked(): void {
    this.detailsOpen.set(false);
    this.onAddClicked();
  }

  /**
   * Clic sur "Ajouter" : émet directement si aucune orientation n'est requise,
   * ouvre le sélecteur sinon (jamais d'émission prématurée — cf. en-tête).
   */
  onAddClicked(): void {
    if (this.requiresOrientation()) {
      this.choosingOrientation.set(true);
      return;
    }
    this.chosen.emit({ nomInterne: this.option().nomInterne });
  }

  /** Clic sur une direction du sélecteur : émet le choix complet et referme le sélecteur. */
  onOrientationChosen(orientation: Orientation): void {
    this.chosen.emit({ nomInterne: this.option().nomInterne, orientation });
    this.choosingOrientation.set(false);
  }

  /** "Annuler" : referme le sélecteur sans émettre — l'utilisateur change d'avis. */
  cancelOrientation(): void {
    this.choosingOrientation.set(false);
  }
}
