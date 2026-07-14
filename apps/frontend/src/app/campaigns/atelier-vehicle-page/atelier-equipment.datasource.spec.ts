/**
 * Tests unitaires — AtelierEquipmentDataSource (F6c) + mapWorkshopVehicleToVehicle.
 *
 * La source atelier traduit chaque add/remove en un `POST .../events/equipment`
 * (via `CampaignsService.changeEquipment`), puis relit l'état d'atelier
 * (`getWorkshop`) et remappe le véhicule concerné vers la forme `Vehicle` attendue
 * par `EquipmentManager`. On mocke `CampaignsService` (aucun appel réseau réel) et
 * on fournit un `ActivatedRoute` factice pour le `campaignId`.
 */
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { vi } from 'vitest';
import { AtelierEquipmentDataSource } from './atelier-equipment.datasource';
import { CampaignsService } from '../campaigns.service';
import { WorkshopStateDto, mapWorkshopVehicleToVehicle } from '../workshop.model';

const workshop: WorkshopStateDto = {
  participantId: 1,
  sponsor: 'Miyazaki',
  wallet: 10,
  championshipPoints: 0,
  vehicles: [
    {
      id: 5,
      nomInterne: 'voiture',
      price: 12,
      isLost: false,
      chocs: 0,
      sequellas: [],
      weapons: [
        { id: 9, nomInterne: 'mitrailleuse', orientation: 'avant', price: 3, estDefaut: false, isLost: false, isSold: false, purchasedThisSession: false },
        { id: 10, nomInterne: 'bfg', orientation: 'tourelle', price: 45, estDefaut: false, isLost: false, isSold: false, purchasedThisSession: false },
      ],
      improvements: [
        { id: 2, nomInterne: 'blindage', orientation: null, price: 4, emplacement: 1, estDefaut: false, isLost: false, isSold: false, purchasedThisSession: false },
      ],
      advantages: [
        { id: 3, nomInterne: 'expertise', price: 3, isSold: false, purchasedThisSession: false },
      ],
      resaleRefund: 6,
      purchasedThisSession: false,
      emplacementsTotal: 5,
    },
  ],
};

describe('mapWorkshopVehicleToVehicle', () => {
  it('traduit un véhicule d\'atelier vers la forme Vehicle (price → prix, emplacement conservé)', () => {
    const v = mapWorkshopVehicleToVehicle(workshop.vehicles[0]);
    expect(v.id).toBe(5);
    expect(v.nomInterne).toBe('voiture');
    expect(v.weapons[0].prix).toBe(3);
    expect(v.weapons[0].orientation).toBe('avant');
    expect(v.improvements[0].prix).toBe(4);
    expect(v.improvements[0].emplacement).toBe(1);
    // Régression IHM (remorques) : la capacité EFFECTIVE (bonus remorque inclus,
    // résolue côté backend) doit être propagée telle quelle, jamais recalculée.
    expect(v.emplacementsTotal).toBe(5);
  });

  it('conserve l\'orientation \'tourelle\' pour une arme montée sur Tourelle', () => {
    const v = mapWorkshopVehicleToVehicle(workshop.vehicles[0]);
    expect(v.weapons[1].orientation).toBe('tourelle');
    expect(v.weapons[1].prix).toBe(45);
  });
});

describe('AtelierEquipmentDataSource', () => {
  let ds: AtelierEquipmentDataSource;
  let service: {
    changeEquipment: ReturnType<typeof vi.fn>;
    getWorkshop: ReturnType<typeof vi.fn>;
    getWorkshopAvailableWeapons: ReturnType<typeof vi.fn>;
    getWorkshopAvailableImprovements: ReturnType<typeof vi.fn>;
    getWorkshopAvailableAdvantages: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      changeEquipment: vi.fn().mockReturnValue(of(undefined)),
      getWorkshop: vi.fn().mockReturnValue(of(workshop)),
      getWorkshopAvailableWeapons: vi.fn().mockReturnValue(of([])),
      getWorkshopAvailableImprovements: vi.fn().mockReturnValue(of([])),
      getWorkshopAvailableAdvantages: vi.fn().mockReturnValue(of([])),
    };

    TestBed.configureTestingModule({
      providers: [
        AtelierEquipmentDataSource,
        { provide: CampaignsService, useValue: service },
        { provide: ActivatedRoute, useValue: { snapshot: { params: { id: '7' } } } },
      ],
    });
    ds = TestBed.inject(AtelierEquipmentDataSource);
  });

  it('addWeapon → BUY WEAPON (campaignId de la route), relit puis remappe le véhicule', async () => {
    const v = await firstValueFrom(ds.addWeapon(5, { nomInterne: 'mitrailleuse', orientation: 'avant' }));

    expect(service.changeEquipment).toHaveBeenCalledWith(7, {
      operation: 'BUY',
      entityType: 'WEAPON',
      nomInterne: 'mitrailleuse',
      targetVehicleId: 5,
      targetEntityId: null,
      orientation: 'avant',
    });
    expect(service.getWorkshop).toHaveBeenCalledWith(7);
    expect(v.id).toBe(5);
    expect(v.weapons[0].prix).toBe(3);
  });

  it('addWeapon avec orientation \'tourelle\' transmet la valeur au backend', async () => {
    await firstValueFrom(ds.addWeapon(5, { nomInterne: 'bfg', orientation: 'tourelle' }));

    expect(service.changeEquipment).toHaveBeenCalledWith(7, {
      operation: 'BUY',
      entityType: 'WEAPON',
      nomInterne: 'bfg',
      targetVehicleId: 5,
      targetEntityId: null,
      orientation: 'tourelle',
    });
  });

  it('addImprovement → BUY IMPROVEMENT', async () => {
    await firstValueFrom(ds.addImprovement(5, { nomInterne: 'blindage' }));
    expect(service.changeEquipment).toHaveBeenCalledWith(7, {
      operation: 'BUY',
      entityType: 'IMPROVEMENT',
      nomInterne: 'blindage',
      targetVehicleId: 5,
      targetEntityId: null,
      orientation: null,
    });
  });

  it('removeWeapon → SELL WEAPON (targetEntityId = id de l\'arme)', async () => {
    await firstValueFrom(ds.removeWeapon(5, 9));
    expect(service.changeEquipment).toHaveBeenCalledWith(7, {
      operation: 'SELL',
      entityType: 'WEAPON',
      nomInterne: '',
      targetVehicleId: 5,
      targetEntityId: 9,
      orientation: null,
    });
  });

  it('removeImprovement → SELL IMPROVEMENT', async () => {
    await firstValueFrom(ds.removeImprovement(5, 2));
    expect(service.changeEquipment).toHaveBeenCalledWith(7, {
      operation: 'SELL',
      entityType: 'IMPROVEMENT',
      nomInterne: '',
      targetVehicleId: 5,
      targetEntityId: 2,
      orientation: null,
    });
  });

  it('getAvailableWeapons délègue au service atelier avec le campaignId de la route', () => {
    ds.getAvailableWeapons(5);
    expect(service.getWorkshopAvailableWeapons).toHaveBeenCalledWith(7, 5);
  });
});
