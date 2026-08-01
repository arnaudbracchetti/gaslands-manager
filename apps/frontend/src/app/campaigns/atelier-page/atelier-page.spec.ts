/**
 * Tests unitaires pour AtelierPage — écran liste de l'atelier campagne
 * (`/campaigns/:id/atelier`).
 *
 * Ce qui est testé :
 *   - chargement du workshop + catalogue sponsor + nom de campagne (fil d'Ariane)
 *   - construction des résumés de véhicules (`VehicleSummary`) affichés en cartes
 *   - navigation vers l'écran de configuration au clic sur une carte
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AtelierPage } from './atelier-page';
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
  sabotagePoints: 2,
  vehicles: [
    {
      id: 5,
      nomInterne: 'camion',
      nom: 'Camion',
      customName: null,
      price: 16,
      isLost: false,
      chocs: 0,
      sequellas: [],
      weapons: [],
      improvements: [],
      advantages: [],
      resaleRefund: 8,
      chassisResaleRefund: 8,
      purchasedThisSession: false,
      emplacementsTotal: 4,
    },
  ],
};

describe('AtelierPage', () => {
  let fixture: ComponentFixture<AtelierPage>;
  let component: AtelierPage;
  let router: Router;
  let mockCampaignsService: {
    getOne: ReturnType<typeof vi.fn>;
    getWorkshop: ReturnType<typeof vi.fn>;
    getWorkshopAvailableVehicles: ReturnType<typeof vi.fn>;
  };
  let mockCatalogService: { getSponsorByName: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockCampaignsService = {
      getOne: vi.fn().mockReturnValue(of(mockCampaign)),
      getWorkshop: vi.fn().mockReturnValue(of(mockWorkshop)),
      // Verdicts de disponibilité budgétaire des véhicules (grille "+ Ajouter un
      // véhicule") — `of([])` suffit, aucun de ces tests n'exerce le grisage.
      getWorkshopAvailableVehicles: vi.fn().mockReturnValue(of([])),
    };
    mockCatalogService = {
      getSponsorByName: vi.fn().mockReturnValue(of(mockSponsorCatalog)),
    };
  });

  afterEach(() => vi.clearAllMocks());

  function createFixture(campaignId: string): void {
    const activatedRouteMock = {
      snapshot: { params: { id: campaignId } },
    };

    TestBed.configureTestingModule({
      imports: [AtelierPage],
      providers: [
        provideRouter([]),
        { provide: CampaignsService, useValue: mockCampaignsService },
        { provide: CatalogService, useValue: mockCatalogService },
        { provide: ActivatedRoute, useValue: activatedRouteMock },
      ],
    });

    fixture = TestBed.createComponent(AtelierPage);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  }

  it('charge le workshop, le catalogue et le nom de campagne au démarrage', () => {
    createFixture('3');

    expect(mockCampaignsService.getWorkshop).toHaveBeenCalledWith(3);
    expect(mockCampaignsService.getOne).toHaveBeenCalledWith(3);
    expect(mockCatalogService.getSponsorByName).toHaveBeenCalledWith('Rutherford');
    expect(component.loading()).toBe(false);
    expect(component.wallet()).toBe(10);
  });

  it('construit les résumés de véhicules affichés en cartes', () => {
    createFixture('3');

    expect(component.vehicleSummaries()).toHaveLength(1);
    expect(component.vehicleSummaries()[0].nom).toBe('Camion');

    const el = fixture.nativeElement as HTMLElement;
    const card = el.querySelector('app-vehicle-summary-card');
    expect(card).toBeTruthy();
  });

  it('rend <app-breadcrumb> avec le nom de campagne', () => {
    createFixture('3');

    expect(component.breadcrumbs()).toEqual([
      { label: 'Mes Campagnes', route: ['/campaigns'] },
      { label: 'Les Terres Brûlées', route: ['/campaigns', '3'] },
      { label: 'Atelier' },
    ]);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-breadcrumb')).toBeTruthy();
  });

  it('onManage() navigue vers /campaigns/:id/atelier/vehicles/:vehicleId', () => {
    createFixture('3');
    const navigateSpy = vi.spyOn(router, 'navigate');

    component.onManage(5);

    expect(navigateSpy).toHaveBeenCalledWith(['/campaigns', 3, 'atelier', 'vehicles', 5]);
  });

  it("affiche une erreur si le chargement de l'atelier échoue", () => {
    mockCampaignsService.getWorkshop.mockReturnValue(throwError(() => new Error('Network error')));

    createFixture('3');

    expect(component.error()).toContain("Impossible de charger l'atelier");
    expect(component.loading()).toBe(false);
  });
});
