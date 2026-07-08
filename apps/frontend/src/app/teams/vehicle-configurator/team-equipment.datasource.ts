/**
 * TeamEquipmentDataSource — implémentation "construction d'équipe" d'`EquipmentDataSource`.
 *
 * Simple délégation à `VehicleService` (routes CRUD `/api/teams` + `/api/vehicles/:id/...`).
 * Fournie par la route du configurateur d'équipe via
 * `providers: [{ provide: EQUIPMENT_DATA_SOURCE, useClass: TeamEquipmentDataSource }]`.
 *
 * Les retraits renvoient le `Vehicle` mis à jour (les routes DELETE le renvoient
 * depuis F4) — plus besoin de recharger toute l'équipe côté composant.
 */
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { VehicleService } from './vehicle.service';
import { EquipmentDataSource } from './equipment-data-source';
import { AvailableImprovementDto, AvailableWeaponDto, EquipmentChoice, Vehicle } from './vehicle-builder.model';

@Injectable()
export class TeamEquipmentDataSource implements EquipmentDataSource {
  private vs: VehicleService = inject(VehicleService);

  getAvailableWeapons(vehicleId: number): Observable<AvailableWeaponDto[]> {
    return this.vs.getAvailableWeapons(vehicleId);
  }

  getAvailableImprovements(vehicleId: number): Observable<AvailableImprovementDto[]> {
    return this.vs.getAvailableImprovements(vehicleId);
  }

  addWeapon(vehicleId: number, choice: EquipmentChoice): Observable<Vehicle> {
    return this.vs.addWeapon(vehicleId, choice);
  }

  addImprovement(vehicleId: number, choice: EquipmentChoice): Observable<Vehicle> {
    return this.vs.addImprovement(vehicleId, choice);
  }

  // La route "à plat" DELETE /weapons/:id ne prend pas le vehicleId — ignoré ici.
  removeWeapon(_vehicleId: number, weaponId: number): Observable<Vehicle> {
    return this.vs.removeWeapon(weaponId);
  }

  removeImprovement(vehicleId: number, improvementId: number): Observable<Vehicle> {
    return this.vs.removeImprovement(vehicleId, improvementId);
  }

  assignWeaponToTourelle(vehicleId: number, improvementId: number, weaponNomInterne: string): Observable<Vehicle> {
    return this.vs.assignWeaponToTourelle(vehicleId, improvementId, weaponNomInterne);
  }

  unassignWeaponFromTourelle(vehicleId: number, improvementId: number): Observable<Vehicle> {
    return this.vs.unassignWeaponFromTourelle(vehicleId, improvementId);
  }
}
