/**
 * MountedEquipment — composant "dumb" affichant les armes et améliorations
 * MONTÉES sur le véhicule en cours d'édition ("Armes (N)"/"Améliorations (N)",
 * ex-sections `.em-current__group` d'`EquipmentManager`). Une arme montée sur
 * Tourelle (`Weapon.orientation === 'tourelle'`) reçoit un badge « (Tourelle) » dans
 * la liste des armes — ce n'est pas une ligne d'amélioration séparée.
 *
 * Purement présentationnel : reçoit `weapons`/`improvements` (entité brute du
 * véhicule) et le `sponsorCatalog` déjà chargé par le parent — nécessaire pour
 * résoudre les noms/emplacements affichés depuis `nomInterne` (mirroir exact
 * de `resolveWeaponName`/`resolveImprovementName`/`resolveWeaponSlot`,
 * déplacées ici telles quelles depuis `EquipmentManager`).
 *
 * Chaque action utilisateur (retrait) est émise via `output()` — c'est
 * `EquipmentManager` (le parent) qui demande confirmation (`window.confirm`)
 * et appelle l'API, conformément au pattern "le parent seul décide"
 * (ARCHITECTURE.md §2.5).
 */
import {
  Component,
  InputSignal,
  OutputEmitterRef,
  Signal,
  WritableSignal,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { Sponsor } from '../../../../catalog/catalog.model';
import { VehicleImprovement, Weapon, VehicleAdvantage } from '../../vehicle-builder.model';

@Component({
  selector: 'app-mounted-equipment',
  standalone: true,
  templateUrl: './mounted-equipment.html',
  styleUrl: './mounted-equipment.scss',
})
export class MountedEquipment {
  /** Armes montées — hors celles absorbées par une ligne Tourelle. */
  weapons: InputSignal<Weapon[]> = input.required<Weapon[]>();

  /** Améliorations posées — les Tourelles reçoivent un traitement spécial. */
  improvements: InputSignal<VehicleImprovement[]> = input.required<VehicleImprovement[]>();

  /** Avantages acquis — jamais d'orientation, jamais d'emplacement. */
  advantages: InputSignal<VehicleAdvantage[]> = input.required<VehicleAdvantage[]>();

  /** Catalogue du sponsor — nécessaire pour résoudre noms/emplacements affichés. */
  sponsorCatalog: InputSignal<Sponsor> = input.required<Sponsor>();

  /**
   * Vrai si le véhicule appartient à une équipe verrouillée (campagne qui n'est
   * plus EN_CONSTRUCTION) — masque tous les boutons de mutation (retrait,
   * assignation/désassignation Tourelle). Défaut `false` : ne change rien pour
   * l'atelier campagne, qui ne renseigne jamais cet input.
   */
  locked: InputSignal<boolean> = input<boolean>(false);

  /** Demande de retrait d'une arme — le parent confirme puis appelle l'API. */
  weaponRemoved: OutputEmitterRef<Weapon> = output<Weapon>();

  /** Demande de retrait d'une amélioration — mirroir de `weaponRemoved`. */
  improvementRemoved: OutputEmitterRef<VehicleImprovement> = output<VehicleImprovement>();

  /** Demande de retrait d'un avantage — mirroir de `weaponRemoved`/`improvementRemoved`. */
  advantageRemoved: OutputEmitterRef<VehicleAdvantage> = output<VehicleAdvantage>();

  // ── Filtre "masquer les équipements vendus/détruits" ────────────────────────
  // Filtre d'affichage pur sur des données déjà reçues — état local à ce
  // composant "dumb", pas besoin de le faire remonter à `EquipmentManager`.
  // `sold`/`lost` ne sont jamais posés côté construction d'équipe (toujours
  // `undefined`), donc `hiddenSoldCount()` y vaut 0 et le bouton de bascule ne
  // s'affiche pas. `lost` (Table des Épaves) suit la même bascule que `sold` —
  // un équipement détruit reste consultable, mais masqué par défaut, comme un
  // équipement vendu.

  showSold: WritableSignal<boolean> = signal(false);

  soldWeaponsCount: Signal<number> = computed((): number =>
    this.weapons().filter((w): boolean => !!w.sold || !!w.lost).length,
  );

  soldImprovementsCount: Signal<number> = computed((): number =>
    this.improvements().filter((i): boolean => !!i.sold || !!i.lost).length,
  );

  /** Mirroir de `soldWeaponsCount`/`soldImprovementsCount` — un avantage ne porte pas `lost`
   *  (pas de mécanisme de perte via la Table des Épaves pour les avantages aujourd'hui). */
  soldAdvantagesCount: Signal<number> = computed((): number =>
    this.advantages().filter((a): boolean => !!a.sold).length,
  );

  hiddenSoldCount: Signal<number> = computed((): number =>
    this.soldWeaponsCount() + this.soldImprovementsCount() + this.soldAdvantagesCount(),
  );

  visibleWeapons: Signal<Weapon[]> = computed((): Weapon[] => {
    const all = this.weapons();
    if (this.showSold()) return all;
    return all.filter((w): boolean => !w.sold && !w.lost);
  });

  visibleImprovements: Signal<VehicleImprovement[]> = computed((): VehicleImprovement[] => {
    const all = this.improvements();
    if (this.showSold()) return all;
    return all.filter((i): boolean => !i.sold && !i.lost);
  });

  visibleAdvantages: Signal<VehicleAdvantage[]> = computed((): VehicleAdvantage[] => {
    const all = this.advantages();
    if (this.showSold()) return all;
    return all.filter((a): boolean => !a.sold);
  });

  // ── Résolution d'affichage (nomInterne → nom) ────────────────────────────────
  // Déplacées telles quelles depuis EquipmentManager (cf. son ancien en-tête,
  // "Résolution d'affichage") — `sponsorCatalog()` est désormais un input plutôt
  // qu'un signal du parent injecté directement.

  /**
   * Résout le nom AFFICHÉ d'une arme montée depuis son `nomInterne` — l'entité
   * brute ne porte que la clé catalogue stable, c'est le catalogue déjà chargé
   * qui connaît le nom présentable. Repli sur `nomInterne` brut si l'entrée est
   * introuvable (incohérence de données — on dégrade proprement plutôt que de
   * planter).
   */
  resolveWeaponName(nomInterne: string): string {
    return this.sponsorCatalog().armes.find((a): boolean => a.nom_interne === nomInterne)?.nom ?? nomInterne;
  }

  /** Résout le nom affiché d'une amélioration posée — mirroir exact de `resolveWeaponName`. */
  resolveImprovementName(nomInterne: string): string {
    return this.sponsorCatalog().ameliorations.find((a): boolean => a.nom_interne === nomInterne)?.nom ?? nomInterne;
  }

  /** Résout le nom affiché d'un avantage acquis — mirroir exact de `resolveWeaponName`. */
  resolveAdvantageName(nomInterne: string): string {
    return this.sponsorCatalog().avantages.find((a): boolean => a.nom_interne === nomInterne)?.nom ?? nomInterne;
  }

  /**
   * Résout l'emplacement consommé par une arme montée depuis le catalogue —
   * mirroir de `resolveWeaponName`. Nécessaire pour le badge 🔧 des lignes
   * "Armes" : `Weapon` (DTO) ne porte pas `emplacement`, contrairement à
   * `VehicleImprovement` qui l'expose déjà résolu.
   */
  resolveWeaponSlot(nomInterne: string): number {
    return this.sponsorCatalog().armes.find((a): boolean => a.nom_interne === nomInterne)?.emplacement ?? 0;
  }
}
