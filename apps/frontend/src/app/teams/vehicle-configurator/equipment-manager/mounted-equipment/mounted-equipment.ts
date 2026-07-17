/**
 * MountedEquipment — composant "dumb" affichant les armes et améliorations
 * MONTÉES sur le véhicule en cours d'édition ("Armes (N)"/"Améliorations (N)",
 * ex-sections `.em-current__group` d'`EquipmentManager`). Une arme montée sur
 * Tourelle (`Weapon.orientation === 'tourelle'`) reçoit un badge « (Tourelle) » dans
 * la liste des armes — ce n'est pas une ligne d'amélioration séparée.
 *
 * Purement présentationnel : reçoit `weapons`/`improvements` (entité brute du
 * véhicule) et le `sponsorCatalog` déjà chargé par le parent — nécessaire pour
 * résoudre les noms affichés depuis `nomInterne` (mirroir exact de
 * `resolveWeaponName`/`resolveImprovementName`, déplacées ici telles quelles
 * depuis `EquipmentManager`). Les emplacements, eux, sont lus directement sur le
 * DTO (`weapon.emplacement`/`improvement.emplacement`, résiduel résolu côté
 * backend) — plus de résolution catalogue, qui était aveugle à l'état vendu.
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
import type { WorkshopSequellaDto } from '../../../../campaigns/workshop.model';
import { Icon } from '../../../../shared/icon/icon';

@Component({
  selector: 'app-mounted-equipment',
  standalone: true,
  imports: [Icon],
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

  /**
   * Séquelles acquises — atelier campagne uniquement, absent (`[]`) en
   * construction d'équipe. `WorkshopSequellaDto.nom` est déjà le nom affiché
   * (contrairement à `nomInterne` pour armes/améliorations/avantages) : pas de
   * résolution catalogue nécessaire pour cette 4ᵉ catégorie.
   */
  sequellas: InputSignal<WorkshopSequellaDto[]> = input<WorkshopSequellaDto[]>([]);

  /**
   * `true` si le véhicule porte encore une "Légende Vivante" active — débloque
   * la revente cross-session des AUTRES séquelles pré-existantes (mirroir de
   * `Vehicle.canRemoveSequella()` côté backend). Calculé par `EquipmentManager`
   * depuis `sequellas()`, pas ici (pure fonction de l'input, mais la logique
   * métier reste centralisée côté smart component).
   */
  sequellaResaleUnlocked: InputSignal<boolean> = input<boolean>(false);

  /**
   * Affiche la section "Séquelles" — gate EXPLICITE plutôt qu'inférée d'un
   * tableau vide (mirroir de `chocs: number | null` sur `VehicleCostSummary`) :
   * `false` par défaut, jamais activée par `VehicleConfigurator` (construction
   * d'équipe, où les séquelles n'existent pas).
   */
  showSequellas: InputSignal<boolean> = input<boolean>(false);

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

  /** Demande de retrait d'une séquelle (annulation ou revente) — mirroir des 3 outputs ci-dessus. */
  sequellaRemoved: OutputEmitterRef<WorkshopSequellaDto> = output<WorkshopSequellaDto>();

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

  /** Mirroir de `soldWeaponsCount`/`soldImprovementsCount` pour les avantages. */
  soldAdvantagesCount: Signal<number> = computed((): number =>
    this.advantages().filter((a): boolean => !!a.sold || !!a.lost).length,
  );

  /** Mirroir de `soldAdvantagesCount` pour les séquelles (`isSold`, pas `sold` — DTO atelier brut). */
  soldSequellasCount: Signal<number> = computed((): number =>
    this.sequellas().filter((s): boolean => s.isSold).length,
  );

  hiddenSoldCount: Signal<number> = computed((): number =>
    this.soldWeaponsCount() + this.soldImprovementsCount() + this.soldAdvantagesCount() + this.soldSequellasCount(),
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
    return all.filter((a): boolean => !a.sold && !a.lost);
  });

  /** Mirroir de `visibleAdvantages` pour les séquelles. */
  visibleSequellas: Signal<WorkshopSequellaDto[]> = computed((): WorkshopSequellaDto[] => {
    const all = this.sequellas();
    if (this.showSold()) return all;
    return all.filter((s): boolean => !s.isSold);
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

  // ── Tooltips des badges prix/emplacement ─────────────────────────────────────
  // Le montant/slot affiché vaut `0` dans deux situations où un chiffre nu prête à
  // confusion : équipement INTÉGRÉ au profil de base (`estDefaut` — gratuit, hors pool
  // d'emplacements) et équipement VENDU en atelier (prix résiduel, emplacement libéré).
  // Ces méthodes explicitent le sens du chiffre. `estDefaut` prime sur `sold` (un
  // équipement intégré n'est jamais revendable) — et, pour une arme, sur le montage
  // Tourelle (le Canon de 125mm du Char d'assaut est intégré ET sur Tourelle, mais son
  // prix affiché est 0 : c'est « intégré, gratuit » qui doit s'afficher, pas « ×3 »).

  /** Tooltip du badge prix d'une arme montée. */
  weaponPriceTitle(weapon: Weapon): string {
    if (weapon.estDefaut) return 'Équipement intégré au profil de base — gratuit';
    if (weapon.sold) return 'Coût résiduel après revente';
    return weapon.orientation === 'tourelle'
      ? 'Coût en jerricans (Tourelle incluse, ×3)'
      : 'Coût en jerricans';
  }

  /** Tooltip du badge emplacement d'une arme montée — mirroir de `weaponPriceTitle`. */
  weaponSlotTitle(weapon: Weapon): string {
    if (weapon.estDefaut) return 'Équipement intégré au profil de base — aucun emplacement consommé';
    if (weapon.sold) return 'Emplacement(s) occupé(s) après la revente';
    return 'Emplacements requis';
  }

  /** Tooltip du badge prix d'une amélioration posée — mirroir de `weaponPriceTitle` (pas de cas Tourelle). */
  improvementPriceTitle(improvement: VehicleImprovement): string {
    if (improvement.estDefaut) return 'Équipement intégré au profil de base — gratuit';
    if (improvement.sold) return 'Coût résiduel après revente';
    return 'Coût en jerricans';
  }

  /** Tooltip du badge emplacement d'une amélioration posée — mirroir de `weaponSlotTitle`. */
  improvementSlotTitle(improvement: VehicleImprovement): string {
    if (improvement.estDefaut) return 'Équipement intégré au profil de base — aucun emplacement consommé';
    if (improvement.sold) return 'Emplacement(s) occupé(s) après la revente';
    return 'Emplacements requis';
  }
}
