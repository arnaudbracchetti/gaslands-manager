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
  budget: 50,
  houseRules: [],
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
  lastSabotageConversionJerricans: null,
  vehicles: [
    {
      id: 5,
      nomInterne: 'camion',
      nom: 'Camion',
      customName: null,
      price: 16,
      isLost: false,
      isSold: false,
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
    convertSabotage: ReturnType<typeof vi.fn>;
    cancelSabotageConversion: ReturnType<typeof vi.fn>;
  };
  let mockCatalogService: { getSponsorByName: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockCampaignsService = {
      getOne: vi.fn().mockReturnValue(of(mockCampaign)),
      getWorkshop: vi.fn().mockReturnValue(of(mockWorkshop)),
      // Verdicts de disponibilité budgétaire des véhicules (grille "+ Ajouter un
      // véhicule") — `of([])` suffit, aucun de ces tests n'exerce le grisage.
      getWorkshopAvailableVehicles: vi.fn().mockReturnValue(of([])),
      convertSabotage: vi.fn().mockReturnValue(of(undefined)),
      cancelSabotageConversion: vi.fn().mockReturnValue(of(undefined)),
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
    expect(mockCatalogService.getSponsorByName).toHaveBeenCalledWith(
      'Rutherford',
    );
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

    expect(navigateSpy).toHaveBeenCalledWith([
      '/campaigns',
      3,
      'atelier',
      'vehicles',
      5,
    ]);
  });

  it("affiche une erreur si le chargement de l'atelier échoue", () => {
    mockCampaignsService.getWorkshop.mockReturnValue(
      throwError(() => new Error('Network error')),
    );

    createFixture('3');

    expect(component.error()).toContain("Impossible de charger l'atelier");
    expect(component.loading()).toBe(false);
  });

  describe('conversion de sabotage (règle maison)', () => {
    const withRule = {
      ...mockCampaign,
      houseRules: ['conversion_sabotage_jerricans'],
    };

    function convertButton(): HTMLButtonElement | null {
      return (
        fixture.nativeElement as HTMLElement
      ).querySelector<HTMLButtonElement>('.atp-convert-btn');
    }

    it("n'affiche aucun bouton quand la règle maison est désactivée", () => {
      createFixture('3');

      expect(convertButton()).toBeNull();
    });

    it("affiche le bouton actif quand la règle est activée et qu'il reste un jeton", () => {
      mockCampaignsService.getOne.mockReturnValue(of(withRule));
      createFixture('3');

      expect(convertButton()).not.toBeNull();
      expect(convertButton()!.disabled).toBe(false);
    });

    it('grise le bouton quand le solde de jetons est nul', () => {
      mockCampaignsService.getOne.mockReturnValue(of(withRule));
      mockCampaignsService.getWorkshop.mockReturnValue(
        of({ ...mockWorkshop, sabotagePoints: 0 }),
      );
      createFixture('3');

      expect(convertButton()!.disabled).toBe(true);
      component.onConvertSabotageRequested();
      expect(component.confirmingConversion()).toBe(false);
    });

    it("ouvre la confirmation avec l'aperçu avant/après, sans appeler l'API", () => {
      mockCampaignsService.getOne.mockReturnValue(of(withRule));
      createFixture('3');

      component.onConvertSabotageRequested();

      expect(component.confirmingConversion()).toBe(true);
      expect(component.conversionMessage()).toContain('Sabotage : 2 → 1');
      expect(component.conversionMessage()).toContain('Cagnotte : 10 → 13');
      expect(mockCampaignsService.convertSabotage).not.toHaveBeenCalled();
    });

    it("à la confirmation, appelle l'API puis recharge l'atelier", () => {
      mockCampaignsService.getOne.mockReturnValue(of(withRule));
      createFixture('3');
      mockCampaignsService.getWorkshop.mockClear();

      component.onConvertSabotageRequested();
      component.onConfirmConversion();

      expect(mockCampaignsService.convertSabotage).toHaveBeenCalledWith(3);
      expect(mockCampaignsService.getWorkshop).toHaveBeenCalledWith(3);
      expect(component.confirmingConversion()).toBe(false);
    });

    it('affiche le message du serveur en cas de refus (400)', () => {
      mockCampaignsService.getOne.mockReturnValue(of(withRule));
      mockCampaignsService.convertSabotage.mockReturnValue(
        throwError(() => ({
          error: { message: 'Aucun jeton de sabotage à convertir.' },
        })),
      );
      createFixture('3');

      component.onConvertSabotageRequested();
      component.onConfirmConversion();

      expect(component.error()).toBe('Aucun jeton de sabotage à convertir.');
      expect(component.confirmingConversion()).toBe(false);
    });
  });

  describe("annulation d'une conversion de sabotage", () => {
    // mockWorkshop.wallet = 10 ; dernière conversion = 3 jerricans
    const converted = { ...mockWorkshop, lastSabotageConversionJerricans: 3 };

    function cancelButton(): HTMLButtonElement | undefined {
      return Array.from(
        (
          fixture.nativeElement as HTMLElement
        ).querySelectorAll<HTMLButtonElement>('.atp-convert-btn'),
      ).find(
        (b: HTMLButtonElement): boolean =>
          b.textContent?.includes('Annuler une conversion') ?? false,
      );
    }

    it("n'affiche aucun bouton d'annulation sans conversion dans la session", () => {
      createFixture('3');

      expect(cancelButton()).toBeUndefined();
    });

    it('affiche le bouton actif quand une conversion existe et que la cagnotte couvre son annulation', () => {
      mockCampaignsService.getWorkshop.mockReturnValue(of(converted));
      createFixture('3');

      expect(cancelButton()).toBeDefined();
      expect(cancelButton()!.disabled).toBe(false);
    });

    it('grise le bouton quand la cagnotte (2) est inférieure aux jerricans convertis (3)', () => {
      mockCampaignsService.getWorkshop.mockReturnValue(
        of({ ...converted, wallet: 2 }),
      );
      createFixture('3');

      expect(cancelButton()!.disabled).toBe(true);
      component.onCancelConversionRequested();
      expect(component.confirmingCancellation()).toBe(false);
    });

    it("ouvre la confirmation avec l'aperçu avant/après, sans appeler l'API", () => {
      mockCampaignsService.getWorkshop.mockReturnValue(of(converted));
      createFixture('3');

      component.onCancelConversionRequested();

      expect(component.confirmingCancellation()).toBe(true);
      expect(component.cancellationMessage()).toContain('Sabotage : 2 → 3');
      expect(component.cancellationMessage()).toContain('Cagnotte : 10 → 7');
      expect(
        mockCampaignsService.cancelSabotageConversion,
      ).not.toHaveBeenCalled();
    });

    it("à la confirmation, appelle l'API puis recharge l'atelier", () => {
      mockCampaignsService.getWorkshop.mockReturnValue(of(converted));
      createFixture('3');
      mockCampaignsService.getWorkshop.mockClear();

      component.onCancelConversionRequested();
      component.onConfirmCancellation();

      expect(
        mockCampaignsService.cancelSabotageConversion,
      ).toHaveBeenCalledWith(3);
      expect(mockCampaignsService.getWorkshop).toHaveBeenCalledWith(3);
      expect(component.confirmingCancellation()).toBe(false);
    });

    it('affiche le message du serveur en cas de refus (400)', () => {
      mockCampaignsService.getWorkshop.mockReturnValue(of(converted));
      mockCampaignsService.cancelSabotageConversion.mockReturnValue(
        throwError(() => ({
          error: {
            message:
              "Impossible d'annuler : les jerricans convertis ont déjà été dépensés.",
          },
        })),
      );
      createFixture('3');

      component.onCancelConversionRequested();
      component.onConfirmCancellation();

      expect(component.error()).toContain('déjà été dépensés');
      expect(component.confirmingCancellation()).toBe(false);
    });
  });
});
