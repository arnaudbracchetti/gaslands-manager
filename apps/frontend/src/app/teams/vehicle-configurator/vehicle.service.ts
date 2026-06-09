/**
 * VehicleService — service Angular pour les appels HTTP de construction de véhicules.
 *
 * Co-localisé avec `VehicleBuilder` (pas dans un dossier `vehicle/` au niveau
 * racine) — même convention que `sponsor-carousel/`, co-localisé avec `team-form`
 * (cf. ARCHITECTURE.md §2.6) : ce service n'est consommé QUE par le builder et
 * ses sous-composants, inutile de lui donner une portée plus large que son usage réel.
 *
 * Mirroir de `TeamsService`/`CatalogService` (cf. leur en-tête) : façade pure sur
 * `HttpClient`, aucune logique métier. `authInterceptor` injecte automatiquement
 * le token JWT — ce service n'a rien à savoir de l'authentification.
 *
 * Cinq méthodes correspondent aux CINQ appels du flux de construction
 * (cf. plan d'architecture, §"VehicleBuilder") :
 *  1. `create`                  → étape 1 : créer le véhicule "nu" dans l'équipe
 *  2/4. `getAvailableImprovements`/`getAvailableWeapons` → étape 2 : charger les options
 *  3/5. `addImprovement`/`addWeapon`                     → étape 2 : équiper (un par un)
 *
 * Deux méthodes supplémentaires gèrent l'arme d'une Tourelle :
 *  `assignWeaponToTourelle`   → PATCH, assigne une arme (orphelin → assigné)
 *  `unassignWeaponFromTourelle` → DELETE, retire l'arme (assigné → orphelin)
 *
 * Une sixième, `getAllForTeam`, est ÉTRANGÈRE au flux de construction : elle sert
 * à `Teams` pour afficher la liste des véhicules sur chaque carte (cf. `vehicle-summary.ts`).
 *
 * `remove`/`removeWeapon`/`removeImprovement` servent la fonctionnalité "modifier/
 * supprimer un véhicule depuis la carte d'équipe". Les retraits simples suivent la
 * convention REST `204 No Content` — d'où `Observable<void>`. Les deux méthodes
 * Tourelle retournent le véhicule rechargé (`200 OK`) — le frontend en a besoin.
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Vehicle,
  CreateVehicleDto,
  AddImprovementDto,
  AvailableImprovementDto,
  AddWeaponDto,
  AvailableWeaponDto,
} from './vehicle-builder.model';

@Injectable({ providedIn: 'root' })
export class VehicleService {
  // inject() : syntaxe Angular moderne, équivalent au paramètre de constructeur.
  // Type explicite requis sur le membre de classe (règle memberVariableDeclaration).
  private http: HttpClient = inject(HttpClient);

  /**
   * POST /api/teams/:teamId/vehicles → crée un véhicule "nu" dans l'équipe.
   *
   * Étape 1 du builder : persistance IMMÉDIATE dès le choix du véhicule
   * (cf. plan d'architecture, "Décisions actées" — un véhicule sans équipement
   * reste un véhicule valide en Gaslands). Retourne l'entité brute, pas encore
   * équipée (`improvements: []`, `weapons: []`).
   */
  create(teamId: number, dto: CreateVehicleDto): Observable<Vehicle> {
    return this.http.post<Vehicle>(`/api/teams/${teamId}/vehicles`, dto);
  }

  /**
   * GET /api/vehicles/:id/available-improvements → catalogue d'améliorations du
   * sponsor, chacune accompagnée de son verdict de disponibilité (`disponible`/`raison`).
   */
  getAvailableImprovements(vehicleId: number): Observable<AvailableImprovementDto[]> {
    return this.http.get<AvailableImprovementDto[]>(`/api/vehicles/${vehicleId}/available-improvements`);
  }

  /**
   * POST /api/vehicles/:id/improvements → ajoute une amélioration.
   *
   * "Envelopper PUIS valider PUIS persister" (cf. plan, "Décisions actées") :
   * le backend ne persiste QUE si la règle métier est respectée — sinon il
   * répond `400 Bad Request` avec la raison du refus (`RuleResult.reason`).
   * Retourne le véhicule rechargé, nouvelle amélioration incluse.
   */
  addImprovement(vehicleId: number, dto: AddImprovementDto): Observable<Vehicle> {
    return this.http.post<Vehicle>(`/api/vehicles/${vehicleId}/improvements`, dto);
  }

  /**
   * GET /api/vehicles/:id/available-weapons → catalogue d'armes du sponsor,
   * chacune accompagnée de son verdict (mirroir exact de `getAvailableImprovements`).
   */
  getAvailableWeapons(vehicleId: number): Observable<AvailableWeaponDto[]> {
    return this.http.get<AvailableWeaponDto[]>(`/api/vehicles/${vehicleId}/available-weapons`);
  }

  /**
   * POST /api/vehicles/:id/weapons → monte une arme (mirroir exact de `addImprovement`,
   * même contrat "valider puis persister", même retour : véhicule rechargé).
   */
  addWeapon(vehicleId: number, dto: AddWeaponDto): Observable<Vehicle> {
    return this.http.post<Vehicle>(`/api/vehicles/${vehicleId}/weapons`, dto);
  }

  /**
   * GET /api/teams/:teamId/vehicles → liste les véhicules d'une équipe, chacun
   * avec ses `improvements[]`/`weapons[]` (relations chargées par
   * `VehicleService.findAllForTeam`, backend).
   *
   * Utilisé par `Teams` pour construire le résumé affiché sur chaque carte
   * (cf. `vehicle-summary.ts`, `buildVehicleSummary`) — PAS par `VehicleBuilder`,
   * qui n'a besoin que de CRÉER des véhicules (étape 1), jamais de les lister :
   * d'où sa place en sixième position, hors de la numérotation "flux de
   * construction" ci-dessus.
   */
  getAllForTeam(teamId: number): Observable<Vehicle[]> {
    return this.http.get<Vehicle[]>(`/api/teams/${teamId}/vehicles`);
  }

  /**
   * DELETE /api/vehicles/:id → supprime le véhicule (et, par cascade côté
   * backend, tout son équipement). Utilisé par `Teams.deleteVehicle`, après
   * confirmation de l'utilisateur (cf. `window.confirm`, mirroir de `deleteTeam`).
   */
  remove(vehicleId: number): Observable<void> {
    return this.http.delete<void>(`/api/vehicles/${vehicleId}`);
  }

  /**
   * DELETE /api/weapons/:id → retire une arme montée sur un véhicule.
   *
   * Route "à plat" sous `/weapons` (pas `/vehicles/:id/weapons/:weaponId`) —
   * reflet exact de la route backend (cf. `WeaponController`, en-tête) : `Weapon`
   * porte son propre id, inutile de faire transiter `vehicleId` dans l'URL.
   */
  removeWeapon(weaponId: number): Observable<void> {
    return this.http.delete<void>(`/api/weapons/${weaponId}`);
  }

  /**
   * DELETE /api/vehicles/:id/improvements/:improvementId → retire une amélioration
   * posée sur un véhicule (mirroir d'`addImprovement`, mais en sens inverse).
   *
   * Route nichée sous `/vehicles/:id` — reflet exact de la route backend
   * (cf. `VehicleController.removeImprovement`, en-tête : symétrique de
   * `POST :id/improvements`, contrairement à `Weapon` qui a sa propre route "à plat").
   */
  removeImprovement(vehicleId: number, improvementId: number): Observable<void> {
    return this.http.delete<void>(`/api/vehicles/${vehicleId}/improvements/${improvementId}`);
  }

  /**
   * PATCH /api/vehicles/:vehicleId/improvements/:improvId/weapon
   * Assigne une arme de catalogue à une Tourelle (état orphelin → assigné).
   *
   * L'arme est référencée par `nom_interne` — pas d'entité Weapon créée.
   * Retourne le véhicule rechargé (200 OK) avec le prix de la Tourelle mis à jour
   * (3× le prix de l'arme choisie).
   */
  assignWeaponToTourelle(vehicleId: number, improvementId: number, weaponNomInterne: string): Observable<Vehicle> {
    return this.http.patch<Vehicle>(
      `/api/vehicles/${vehicleId}/improvements/${improvementId}/weapon`,
      { weaponNomInterne },
    );
  }

  /**
   * DELETE /api/vehicles/:vehicleId/improvements/:improvId/weapon
   * Désassigne l'arme d'une Tourelle (état assigné → orphelin), sans supprimer
   * la Tourelle elle-même.
   *
   * Retourne le véhicule rechargé (200 OK) — différent des retraits simples
   * (`204 No Content`) car l'état du véhicule change et le frontend en a besoin.
   */
  unassignWeaponFromTourelle(vehicleId: number, improvementId: number): Observable<Vehicle> {
    return this.http.delete<Vehicle>(
      `/api/vehicles/${vehicleId}/improvements/${improvementId}/weapon`,
    );
  }
}
