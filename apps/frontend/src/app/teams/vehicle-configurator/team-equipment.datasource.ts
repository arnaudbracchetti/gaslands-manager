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
import {
  AvailableImprovementDto,
  AvailableWeaponDto,
  AvailableAdvantageDto,
  EquipmentChoice,
  Orientation,
  Vehicle,
} from './vehicle-builder.model';

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
    // Une amélioration ne porte jamais 'tourelle' — invariant garanti par
    // EquipmentOption (le bouton "Tourelle x3" n'apparaît que pour les armes,
    // cf. AvailableWeaponDto.montableSurTourelle, absent d'AvailableImprovementDto).
    return this.vs.addImprovement(vehicleId, choice as { nomInterne: string; orientation?: Orientation });
  }

  // La route "à plat" DELETE /weapons/:id ne prend pas le vehicleId — ignoré ici.
  removeWeapon(_vehicleId: number, weaponId: number): Observable<Vehicle> {
    return this.vs.removeWeapon(weaponId);
  }

  removeImprovement(vehicleId: number, improvementId: number): Observable<Vehicle> {
    return this.vs.removeImprovement(vehicleId, improvementId);
  }

  getAvailableAdvantages(vehicleId: number): Observable<AvailableAdvantageDto[]> {
    return this.vs.getAvailableAdvantages(vehicleId);
  }

  addAdvantage(vehicleId: number, choice: EquipmentChoice): Observable<Vehicle> {
    // Un avantage n'a jamais d'orientation — invariant garanti par EquipmentOption
    // (requiresOrientation=false pour les avantages, cf. equipment-manager.html).
    return this.vs.addAdvantage(vehicleId, { nomInterne: choice.nomInterne });
  }

  removeAdvantage(vehicleId: number, advantageId: number): Observable<Vehicle> {
    return this.vs.removeAdvantage(vehicleId, advantageId);
  }

  renameVehicle(vehicleId: number, nom: string): Observable<Vehicle> {
    return this.vs.rename(vehicleId, nom);
  }
}
