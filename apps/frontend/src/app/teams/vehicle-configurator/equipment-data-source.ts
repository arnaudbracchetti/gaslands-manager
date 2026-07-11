/**
 * EquipmentDataSource — abstraction de la source de données de gestion d'équipement.
 *
 * `EquipmentManager` (composant "smart" partagé) parle à CETTE interface au lieu
 * d'injecter `VehicleService` en dur. Deux implémentations la fournissent :
 *  - `TeamEquipmentDataSource` : construction d'équipe (CRUD, routes `/api/teams`
 *    et `/api/vehicles/:id/...`) — enrobe `VehicleService`.
 *  - `AtelierEquipmentDataSource` : atelier campagne (event-sourcing, routes
 *    `/api/campaigns/:id/...`) — traduit achat/retrait en événements.
 *
 * Le câblage est fait PAR LA ROUTE via `providers: [{ provide: EQUIPMENT_DATA_SOURCE,
 * useClass: ... }]` : `EquipmentManager` reçoit la bonne implémentation sans jamais
 * savoir laquelle. C'est le miroir frontend du Dependency Inversion déjà en place au
 * backend (`ITeamRepository`/`ICatalogRepository` + tokens) — cf. doc de conception
 * 2026-07-07-atelier-reutilisation-configurateur-design.md.
 *
 * Convention de retour : toutes les mutations (add/remove) renvoient le `Vehicle`
 * MIS À JOUR, pour que le composant émette directement `vehicleChanged` sans
 * recharger toute l'équipe. Côté équipe, cela a nécessité que les routes DELETE
 * renvoient le véhicule (F4) ; côté atelier, l'implémentation relit l'état d'atelier.
 *
 * Le montage sur Tourelle n'est pas une opération séparée : c'est une valeur
 * d'orientation choisie à l'achat de l'arme (`EquipmentChoice.orientation =
 * 'tourelle'`), portée par `addWeapon` ci-dessous — il n'existe pas de Tourelle
 * indépendante à réassigner, seulement une arme qu'on revend puis rachète.
 */
import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AvailableImprovementDto,
  AvailableWeaponDto,
  EquipmentChoice,
  Vehicle,
} from './vehicle-builder.model';

export interface EquipmentDataSource {
  getAvailableWeapons(vehicleId: number): Observable<AvailableWeaponDto[]>;
  getAvailableImprovements(vehicleId: number): Observable<AvailableImprovementDto[]>;
  addWeapon(vehicleId: number, choice: EquipmentChoice): Observable<Vehicle>;
  addImprovement(vehicleId: number, choice: EquipmentChoice): Observable<Vehicle>;
  removeWeapon(vehicleId: number, weaponId: number): Observable<Vehicle>;
  removeImprovement(vehicleId: number, improvementId: number): Observable<Vehicle>;
}

export const EQUIPMENT_DATA_SOURCE = new InjectionToken<EquipmentDataSource>('EquipmentDataSource');

/**
 * Budget fourni en `input` à `EquipmentManager` par son parent — remplace la lecture
 * directe de `team.cans` + le calcul `getAllForTeam` du coût des autres véhicules
 * (couplage équipe supprimé, F3). Le parent choisit la sémantique :
 *  - construction d'équipe : `{ total: team.cans, usedByOthers: coût des autres véhicules }`
 *  - atelier campagne       : `{ total: wallet, usedByOthers: coût des autres véhicules de campagne }`
 *
 * `EquipmentManager` calcule `budgetRestant = total - usedByOthers - coût du véhicule courant`.
 */
export interface BudgetView {
  total: number;
  usedByOthers: number;
}
