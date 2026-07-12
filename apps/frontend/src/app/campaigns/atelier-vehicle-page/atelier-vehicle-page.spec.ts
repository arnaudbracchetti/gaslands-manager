/**
 * Tests unitaires pour AtelierVehiclePage — écran de configuration d'équipement
 * d'un véhicule d'atelier (`/campaigns/:id/atelier/vehicles/:vehicleId`).
 *
 * Mirroir de `vehicle-configurator-page.spec.ts` côté approche : `EquipmentManager`
 * est rendu RÉELLEMENT (standalone, importé par cette page) — on complète donc les
 * mocks de `CampaignsService` avec ce dont IL a besoin pour démarrer
 * (`getWorkshopAvailableWeapons`/`getWorkshopAvailableImprovements`, `of([])` —
 * son affichage n'est pas l'objet de CES tests).
 *
 * Ce qui EST testé ici, spécifique à cette page :
 *   - résolution de `campaignId`/`vehicleId` depuis les paramètres de route
 *   - véhicule introuvable dans le workshop
 *   - câblage `[vehicle]`/`[sponsorCatalog]`/`[budget]`/`[allowResale]="true"` vers `<app-equipment-manager>`
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AtelierVehiclePage } from './atelier-vehicle-page';
import { CampaignsService } from '../campaigns.service';
import { CatalogService } from '../../catalog/catalog.service';
import { Sponsor, Vehicule } from '../../catalog/catalog.model';
import { Campaign } from '../campaign.model';
import { WorkshopStateDto } from '../workshop.model';

const mockCampaign: Campaign = {
  id: 3,
  name: 'Les Terres Brûlées',
  state: 'EN_COURS',
  inviteCode: 'ABC123',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  participantCount: 2,
  myRole: 'participant',
};

const mockVehicule: Vehicule = {
  nom: 'Camion',
  nom_interne: 'camion',
  poids: 'Moyen',
  carrosserie: 12,
  manoeuvrabilite: 1,
  vitesse_max: 5,
  equipage: 2,
  emplacements: 4,
  prix: 16,
  description: 'Un poids lourd polyvalent.',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

const mockSponsorCatalog: Sponsor = {
  nom: 'Rutherford',
  description: 'Sponsor militaire.',
  classes_avantage: ['Militaire'],
  avantages_sponsorises: '',
  vehicules: [mockVehicule],
  armes: [],
  ameliorations: [],
  avantages: [],
};

const mockWorkshop: WorkshopStateDto = {
  participantId: 1,
  sponsor: 'Rutherford',
  wallet: 10,
  championshipPoints: 0,
  vehicles: [
    {
      id: 5,
      nomInterne: 'camion',
      price: 16,
      isLost: false,
      chocs: 0,
      sequellas: [],
      weapons: [],
      improvements: [],
      advantages: [],
      resaleRefund: 8,
      purchasedThisSession: false,
    },
  ],
};

describe('AtelierVehiclePage', () => {
  let fixture: ComponentFixture<AtelierVehiclePage>;
  let component: AtelierVehiclePage;
  let mockCampaignsService: {
    getOne: ReturnType<typeof vi.fn>;
    getWorkshop: ReturnType<typeof vi.fn>;
    getWorkshopAvailableWeapons: ReturnType<typeof vi.fn>;
    getWorkshopAvailableImprovements: ReturnType<typeof vi.fn>;
    getWorkshopAvailableAdvantages: ReturnType<typeof vi.fn>;
    changeEquipment: ReturnType<typeof vi.fn>;
  };
  let mockCatalogService: { getSponsorByName: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockCampaignsService = {
      getOne: vi.fn().mockReturnValue(of(mockCampaign)),
      getWorkshop: vi.fn().mockReturnValue(of(mockWorkshop)),
      getWorkshopAvailableWeapons: vi.fn().mockReturnValue(of([])),
      getWorkshopAvailableImprovements: vi.fn().mockReturnValue(of([])),
      getWorkshopAvailableAdvantages: vi.fn().mockReturnValue(of([])),
      changeEquipment: vi.fn().mockReturnValue(of(undefined)),
    };
    mockCatalogService = {
      getSponsorByName: vi.fn().mockReturnValue(of(mockSponsorCatalog)),
    };
  });

  afterEach(() => vi.clearAllMocks());

  function createFixture(campaignId: string, vehicleId: string): void {
    const activatedRouteMock = {
      snapshot: { params: { id: campaignId, vehicleId } },
    };

    TestBed.configureTestingModule({
      imports: [AtelierVehiclePage],
      providers: [
        provideRouter([]),
        { provide: CampaignsService, useValue: mockCampaignsService },
        { provide: CatalogService, useValue: mockCatalogService },
        { provide: ActivatedRoute, useValue: activatedRouteMock },
      ],
    });

    fixture = TestBed.createComponent(AtelierVehiclePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('résout campaignId/vehicleId depuis la route et charge le véhicule ciblé', () => {
    createFixture('3', '5');

    expect(mockCampaignsService.getWorkshop).toHaveBeenCalledWith(3);
    expect(component.campaignId).toBe(3);
    expect(component.vehicleId).toBe(5);
    expect(component.vehicle()?.id).toBe(5);
    expect(component.loading()).toBe(false);
    expect(component.error()).toBe('');
  });

  it('rend <app-equipment-manager> une fois le véhicule et le catalogue chargés', () => {
    createFixture('3', '5');

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-equipment-manager')).toBeTruthy();
    expect(el.textContent).toContain('Camion');
  });

  it("affiche une erreur si le véhicule n'existe pas dans le workshop", () => {
    createFixture('3', '999');

    expect(component.error()).toBe('Véhicule introuvable.');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-equipment-manager')).toBeNull();
    expect(el.querySelector('.vcp-status--error')).toBeTruthy();
  });

  it("affiche une erreur si le chargement de l'atelier échoue", () => {
    mockCampaignsService.getWorkshop.mockReturnValue(throwError(() => new Error('Network error')));

    createFixture('3', '5');

    expect(component.error()).toContain("Impossible de charger l'atelier");
    expect(component.loading()).toBe(false);
  });

  it('rend <app-breadcrumb> avec le nom de campagne et le nom du véhicule', () => {
    createFixture('3', '5');

    expect(mockCampaignsService.getOne).toHaveBeenCalledWith(3);
    expect(component.breadcrumbs()).toEqual([
      { label: 'Mes Campagnes', route: ['/campaigns'] },
      { label: 'Les Terres Brûlées', route: ['/campaigns', '3'] },
      { label: 'Atelier', route: ['/campaigns', '3', 'atelier'] },
      { label: 'Camion' },
    ]);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-breadcrumb')).toBeTruthy();
  });
});
