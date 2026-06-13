/**
 * MountedEquipment — composant "dumb" affichant les armes et améliorations
 * MONTÉES sur le véhicule en cours d'édition ("Armes (N)"/"Améliorations (N)",
 * ex-sections `.em-current__group` d'`EquipmentManager`), avec toute la
 * logique d'affichage de la Tourelle (ligne fusionnée "Arme (Tourelle)",
 * Tourelle orpheline, badges 🔒 *Intégré*).
 *
 * Purement présentationnel : reçoit `weapons`/`improvements` (entité brute du
 * véhicule) et le `sponsorCatalog` déjà chargé par le parent — nécessaire pour
 * résoudre les noms/emplacements affichés depuis `nomInterne` (mirroir exact
 * de `resolveWeaponName`/`resolveImprovementName`/`resolveWeaponSlot`,
 * déplacées ici telles quelles depuis `EquipmentManager`).
 *
 * Chaque action utilisateur (retrait, assignation/désassignation Tourelle) est
 * émise via `output()` — c'est `EquipmentManager` (le parent) qui demande
 * confirmation (`window.confirm`) et appelle l'API, conformément au pattern
 * "le parent seul décide" (ARCHITECTURE.md §2.5).
 */
import { Component, InputSignal, OutputEmitterRef, input, output } from '@angular/core';
import { Sponsor } from '../../../../catalog/catalog.model';
import { VehicleImprovement, Weapon } from '../../vehicle-builder.model';

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

  /** Catalogue du sponsor — nécessaire pour résoudre noms/emplacements affichés. */
  sponsorCatalog: InputSignal<Sponsor> = input.required<Sponsor>();

  /** Demande de retrait d'une arme — le parent confirme puis appelle l'API. */
  weaponRemoved: OutputEmitterRef<Weapon> = output<Weapon>();

  /** Demande de retrait d'une amélioration — mirroir de `weaponRemoved`. */
  improvementRemoved: OutputEmitterRef<VehicleImprovement> = output<VehicleImprovement>();

  /** Ouvre la modale d'assignation d'arme pour une Tourelle orpheline. */
  tourelleAssignRequested: OutputEmitterRef<VehicleImprovement> = output<VehicleImprovement>();

  /** Désassigne l'arme d'une Tourelle (assigné → orphelin), sans confirmation. */
  tourelleUnassignRequested: OutputEmitterRef<VehicleImprovement> = output<VehicleImprovement>();

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
