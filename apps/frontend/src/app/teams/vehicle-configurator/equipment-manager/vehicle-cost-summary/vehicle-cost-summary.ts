/**
 * VehicleCostSummary — affiche le nom ÉDITABLE du véhicule, ses emplacements
 * (utilisés/total) et le détail de son coût (Base / + Équipement / Total).
 *
 * Extrait d'`EquipmentManager` (en-tête de `.em-current`) — mirroir de
 * `TeamBudget`, mais PAS un composant purement "dumb" côté nom : il porte l'état
 * local du champ d'édition (`formNom`), auto-save au blur — même pattern que
 * `TeamEditPage` (`formName`/`saveField('name')`), seul endroit du projet à
 * avoir déjà un champ texte en auto-save.
 *
 * Nom choisi pour ne pas entrer en collision avec l'interface `VehicleSummary`
 * (`apps/frontend/src/app/teams/vehicle-summary.ts`, résumé d'un véhicule sur
 * la carte d'équipe — concept différent : ce composant-ci ne porte que le
 * récapitulatif d'UN véhicule, déjà résolu par `EquipmentManager`).
 */
import { Component, InputSignal, OutputEmitterRef, WritableSignal, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SlotGauge } from '../../../../shared/slot-gauge/slot-gauge';
import { Icon } from '../../../../shared/icon/icon';

@Component({
  selector: 'app-vehicle-cost-summary',
  standalone: true,
  imports: [FormsModule, SlotGauge, Icon],
  templateUrl: './vehicle-cost-summary.html',
  styleUrl: './vehicle-cost-summary.scss',
})
export class VehicleCostSummary {
  /** Valeur BRUTE du nom personnalisé — `null` si jamais renommé (cf. `Vehicle.customName`). */
  customName: InputSignal<string | null> = input.required<string | null>();

  /** Nom du type catalogue — fallback d'affichage/édition quand `customName` est `null`. */
  typeNom: InputSignal<string> = input.required<string>();

  /** Désactive le champ (équipe verrouillée hors Atelier). */
  disabled: InputSignal<boolean> = input<boolean>(false);

  /** Émis au blur, uniquement si la valeur a changé (déjà trimmée). */
  nameChanged: OutputEmitterRef<string> = output<string>();

  /** Emplacements actuellement consommés (pool partagé armes + améliorations). */
  emplacementsUtilises: InputSignal<number> = input.required<number>();

  /** Capacité totale du véhicule, résolue depuis le catalogue. */
  emplacementsTotal: InputSignal<number> = input.required<number>();

  /** Prix de base du véhicule (catalogue). */
  coutBase: InputSignal<number> = input.required<number>();

  /** Somme des prix effectifs des armes et améliorations montées. */
  coutEquipement: InputSignal<number> = input.required<number>();

  /** Coût total du véhicule — base + équipement monté. */
  coutTotal: InputSignal<number> = input.required<number>();

  /**
   * Chocs accumulés par ce véhicule (Table des Épaves) — monnaie des séquelles.
   * `null` en construction d'équipe (jamais renseigné par `VehicleConfigurator`,
   * cf. `EquipmentManager`) : la ligne "Chocs" est alors absente plutôt qu'affichée
   * à 0, ce concept n'existant pas hors du mode campagne.
   */
  chocs: InputSignal<number | null> = input<number | null>(null);

  formNom: WritableSignal<string> = signal('');

  constructor() {
    // Ne se resynchronise que lorsque customName()/typeNom() changent (nouveau
    // véhicule chargé) — jamais pendant la frappe, qui ne touche que formNom.
    effect((): void => {
      this.formNom.set(this.customName() ?? this.typeNom());
    });
  }

  onBlur(): void {
    const trimmed = this.formNom().trim();
    const current = this.customName() ?? this.typeNom();
    if (!trimmed || trimmed === current) {
      this.formNom.set(current);
      return;
    }
    this.nameChanged.emit(trimmed);
  }
}
