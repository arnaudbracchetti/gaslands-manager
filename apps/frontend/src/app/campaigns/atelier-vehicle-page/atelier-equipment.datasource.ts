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
 * Le montage sur Tourelle n'est pas une opération séparée : c'est une valeur
 * d'orientation de l'arme (`EquipmentChoice.orientation = 'tourelle'`), transmise à
 * `addWeapon` ci-dessous comme n'importe quel achat — `changeEquipment` calcule le
 * coût ×3 côté serveur.
 */
import { Injectable, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable, map, switchMap } from 'rxjs';
import { EquipmentDataSource } from '../../teams/vehicle-configurator/equipment-data-source';
import {
  AvailableImprovementDto,
  AvailableWeaponDto,
  AvailableAdvantageDto,
  EquipmentChoice,
  Vehicle,
} from '../../teams/vehicle-configurator/vehicle-builder.model';
import { CampaignsService } from '../campaigns.service';
import { WorkshopStateDto, mapWorkshopVehicleToVehicle } from '../workshop.model';

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
    return this.mutate(vehicleId, () => this.service.changeEquipment(this.campaignId, {
      operation: 'BUY',
      entityType: 'WEAPON',
      nomInterne: choice.nomInterne,
      targetVehicleId: vehicleId,
      targetEntityId: null,
      orientation: choice.orientation ?? null,
    }));
  }

  addImprovement(vehicleId: number, choice: EquipmentChoice): Observable<Vehicle> {
    return this.mutate(vehicleId, () => this.service.changeEquipment(this.campaignId, {
      operation: 'BUY',
      entityType: 'IMPROVEMENT',
      nomInterne: choice.nomInterne,
      targetVehicleId: vehicleId,
      targetEntityId: null,
      orientation: choice.orientation ?? null,
    }));
  }

  removeWeapon(vehicleId: number, weaponId: number): Observable<Vehicle> {
    return this.mutate(vehicleId, () => this.service.changeEquipment(this.campaignId, {
      operation: 'SELL',
      entityType: 'WEAPON',
      nomInterne: '',
      targetVehicleId: vehicleId,
      targetEntityId: weaponId,
      orientation: null,
    }));
  }

  removeImprovement(vehicleId: number, improvementId: number): Observable<Vehicle> {
    return this.mutate(vehicleId, () => this.service.changeEquipment(this.campaignId, {
      operation: 'SELL',
      entityType: 'IMPROVEMENT',
      nomInterne: '',
      targetVehicleId: vehicleId,
      targetEntityId: improvementId,
      orientation: null,
    }));
  }

  getAvailableAdvantages(vehicleId: number): Observable<AvailableAdvantageDto[]> {
    return this.service.getWorkshopAvailableAdvantages(this.campaignId, vehicleId);
  }

  addAdvantage(vehicleId: number, choice: EquipmentChoice): Observable<Vehicle> {
    return this.mutate(vehicleId, () => this.service.changeEquipment(this.campaignId, {
      operation: 'BUY',
      entityType: 'ADVANTAGE',
      nomInterne: choice.nomInterne,
      targetVehicleId: vehicleId,
      targetEntityId: null,
      orientation: null,
    }));
  }

  removeAdvantage(vehicleId: number, advantageId: number): Observable<Vehicle> {
    return this.mutate(vehicleId, () => this.service.changeEquipment(this.campaignId, {
      operation: 'SELL',
      entityType: 'ADVANTAGE',
      nomInterne: '',
      targetVehicleId: vehicleId,
      targetEntityId: advantageId,
      orientation: null,
    }));
  }

  /**
   * Applique une mutation d'atelier (achat/revente d'équipement) puis relit l'état
   * d'atelier pour renvoyer le véhicule concerné, à jour (chaque endpoint de mutation
   * renvoie 204). Le replay backend reconstitue les entités transientes avec leur id
   * définitif.
   */
  private mutate(vehicleId: number, request: () => Observable<void>): Observable<Vehicle> {
    const campaignId = this.campaignId;
    return request().pipe(
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
