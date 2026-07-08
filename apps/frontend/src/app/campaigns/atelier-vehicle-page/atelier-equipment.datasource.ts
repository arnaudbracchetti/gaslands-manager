/**
 * AtelierEquipmentDataSource — implémentation "atelier campagne" d'`EquipmentDataSource`.
 *
 * Miroir event-sourcing du `TeamEquipmentDataSource` (qui, lui, fait du CRUD via
 * `VehicleService`). Ici chaque ajout/retrait est traduit en un événement
 * `POST /api/campaigns/:id/events/equipment` (204), puis l'état d'atelier est relu
 * (`GET .../workshop`) et le véhicule concerné remappé vers la forme `Vehicle`
 * attendue par `EquipmentManager` (cf. `mapWorkshopVehicleToVehicle`).
 *
 * Fournie au niveau du composant `AtelierVehiclePage` via
 * `providers: [{ provide: EQUIPMENT_DATA_SOURCE, useExisting: AtelierEquipmentDataSource }]`.
 * Le `campaignId` est lu depuis la route (`campaigns/:id/atelier/vehicles/:vehicleId`).
 *
 * Limite Temps 1 : la Tourelle est exclue de l'atelier (prix variable ×3 +
 * assignation d'arme sans événement campagne dédié) — `assignWeaponToTourelle`/
 * `unassignWeaponFromTourelle` échouent explicitement (cf. doc de conception
 * 2026-07-07-atelier-reutilisation-configurateur-design.md, R3b/Temps 2).
 */
import { Injectable, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable, map, switchMap, throwError } from 'rxjs';
import { EquipmentDataSource } from '../../teams/vehicle-configurator/equipment-data-source';
import { AvailableImprovementDto, AvailableWeaponDto, EquipmentChoice, Vehicle } from '../../teams/vehicle-configurator/vehicle-builder.model';
import { CampaignsService } from '../campaigns.service';
import { ChangeEquipmentDto, WorkshopStateDto, mapWorkshopVehicleToVehicle } from '../workshop.model';

@Injectable()
export class AtelierEquipmentDataSource implements EquipmentDataSource {
  private service: CampaignsService = inject(CampaignsService);
  private route: ActivatedRoute = inject(ActivatedRoute);

  private get campaignId(): number {
    return Number(this.route.snapshot.params['id']);
  }

  getAvailableWeapons(vehicleId: number): Observable<AvailableWeaponDto[]> {
    return this.service.getWorkshopAvailableWeapons(this.campaignId, vehicleId);
  }

  getAvailableImprovements(vehicleId: number): Observable<AvailableImprovementDto[]> {
    return this.service.getWorkshopAvailableImprovements(this.campaignId, vehicleId);
  }

  addWeapon(vehicleId: number, choice: EquipmentChoice): Observable<Vehicle> {
    return this.mutate(vehicleId, {
      operation: 'BUY',
      entityType: 'WEAPON',
      nomInterne: choice.nomInterne,
      targetVehicleId: vehicleId,
      targetEntityId: null,
      orientation: choice.orientation ?? null,
    });
  }

  addImprovement(vehicleId: number, choice: EquipmentChoice): Observable<Vehicle> {
    return this.mutate(vehicleId, {
      operation: 'BUY',
      entityType: 'IMPROVEMENT',
      nomInterne: choice.nomInterne,
      targetVehicleId: vehicleId,
      targetEntityId: null,
      orientation: choice.orientation ?? null,
    });
  }

  removeWeapon(vehicleId: number, weaponId: number): Observable<Vehicle> {
    return this.mutate(vehicleId, {
      operation: 'SELL',
      entityType: 'WEAPON',
      nomInterne: '',
      targetVehicleId: vehicleId,
      targetEntityId: weaponId,
      orientation: null,
    });
  }

  removeImprovement(vehicleId: number, improvementId: number): Observable<Vehicle> {
    return this.mutate(vehicleId, {
      operation: 'SELL',
      entityType: 'IMPROVEMENT',
      nomInterne: '',
      targetVehicleId: vehicleId,
      targetEntityId: improvementId,
      orientation: null,
    });
  }

  assignWeaponToTourelle(): Observable<Vehicle> {
    return throwError(() => new Error("La Tourelle n'est pas gérable en atelier pour le moment."));
  }

  unassignWeaponFromTourelle(): Observable<Vehicle> {
    return throwError(() => new Error("La Tourelle n'est pas gérable en atelier pour le moment."));
  }

  /**
   * Applique un événement d'équipement puis relit l'état d'atelier pour renvoyer
   * le véhicule concerné, à jour (l'endpoint POST renvoie 204). Le replay backend
   * reconstitue les entités transientes avec leur id définitif.
   */
  private mutate(vehicleId: number, dto: ChangeEquipmentDto): Observable<Vehicle> {
    const campaignId = this.campaignId;
    return this.service.changeEquipment(campaignId, dto).pipe(
      switchMap((): Observable<WorkshopStateDto> => this.service.getWorkshop(campaignId)),
      map((state): Vehicle => {
        const updated = state.vehicles.find((v): boolean => v.id === vehicleId);
        if (!updated) {
          throw new Error("Véhicule introuvable dans l'atelier après l'opération.");
        }
        return mapWorkshopVehicleToVehicle(updated);
      }),
    );
  }
}
