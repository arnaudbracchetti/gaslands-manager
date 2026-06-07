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
 * Une sixième, `getAllForTeam`, est ÉTRANGÈRE à ce flux : elle ne sert pas au
 * builder mais à `Teams`, qui en a besoin pour afficher la liste des véhicules
 * de chaque équipe sur sa carte (cf. `vehicle-summary.ts`, "résumé affichable").
 * Elle reste ici plutôt que dans un service dédié — même raisonnement de
 * co-localisation par USAGE RÉEL que pour les cinq autres (cf. paragraphe
 * précédent) : c'est `VehicleService` qui encapsule tous les appels HTTP relatifs
 * aux véhicules d'équipe, peu importe quel composant les déclenche.
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
}
