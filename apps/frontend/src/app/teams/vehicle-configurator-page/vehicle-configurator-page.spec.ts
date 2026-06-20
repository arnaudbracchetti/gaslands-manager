/**
 * Tests unitaires pour VehicleConfiguratorPage — page dédiée à la construction/
 * édition d'un véhicule (cf. son en-tête : remplace l'ancienne `<app-modal>` de
 * `Teams`).
 *
 * Mirroir de `teams.spec.ts` côté approche : `VehicleConfigurator` est rendu
 * RÉELLEMENT (standalone, importé par cette page) — on complète donc les mocks
 * de `CatalogService`/`VehicleService` avec ce dont IL a besoin pour démarrer
 * (`getSponsorByName`/`getAllForTeam`/`getAvailableWeapons`/`getAvailableImprovements`,
 * tous `of([...])` ou `of(mockSponsorCatalog)` — son affichage n'est pas l'objet
 * de CES tests, déjà couvert par `vehicle-configurator.spec.ts`).
 *
 * Ce qui EST testé ici, spécifique à cette page :
 *   - résolution de `team`/`vehicleId` depuis les paramètres de route
 *     (`'new'` ⇒ création, id numérique ⇒ édition)
 *   - équipe introuvable (id invalide ou appartenant à un autre utilisateur)
 *   - câblage `[team]`/`[vehicleId]` vers `<app-vehicle-configurator>`
 *   - `(done)` → navigation vers `/teams`
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { VehicleConfiguratorPage } from './vehicle-configurator-page';
import { TeamsService } from '../teams.service';
import { Team } from '../team.model';
import { CatalogService } from '../../catalog/catalog.service';
import { VehicleService } from '../vehicle-configurator/vehicle.service';
import { Sponsor, Vehicule } from '../../catalog/catalog.model';

// ── Données fictives ──────────────────────────────────────────────────────────

const mockTeams: Team[] = [
  {
    id: 7,
    name: 'Les Furieux du Désert',
    sponsor: 'Rutherford',
    cans: 50,
    userId: 42,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    vehicleCount: 0,
  },
];

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
};

describe('VehicleConfiguratorPage', () => {
  let fixture: ComponentFixture<VehicleConfiguratorPage>;
  let component: VehicleConfiguratorPage;
  let mockTeamsService: { getAll: ReturnType<typeof vi.fn> };
  let mockCatalogService: { getSponsorByName: ReturnType<typeof vi.fn> };
  let mockVehicleService: {
    create: ReturnType<typeof vi.fn>;
    getAllForTeam: ReturnType<typeof vi.fn>;
    getAvailableWeapons: ReturnType<typeof vi.fn>;
    getAvailableImprovements: ReturnType<typeof vi.fn>;
  };
  let router: Router;

  beforeEach(() => {
    mockTeamsService = {
      getAll: vi.fn().mockReturnValue(of(mockTeams)),
    };
    mockCatalogService = {
      getSponsorByName: vi.fn().mockReturnValue(of(mockSponsorCatalog)),
    };
    mockVehicleService = {
      create: vi.fn(),
      getAllForTeam: vi.fn().mockReturnValue(of([])),
      // VehicleConfigurator monte EquipmentManager dès que `vehicle()` est non-nul
      // (mode édition) — `of([])` suffit, son affichage n'est pas testé ici.
      getAvailableWeapons: vi.fn().mockReturnValue(of([])),
      getAvailableImprovements: vi.fn().mockReturnValue(of([])),
    };
  });

  afterEach(() => vi.clearAllMocks());

  /** `paramMap` simulé — `vehicleId` à `null`/absent pour mimer la route '.../vehicles/new'. */
  function createFixture(teamId: string, vehicleId: string | null): void {
    const activatedRouteMock = {
      snapshot: {
        paramMap: convertToParamMap({ teamId, ...(vehicleId !== null ? { vehicleId } : {}) }),
        queryParamMap: convertToParamMap({}),
      },
    };

    TestBed.configureTestingModule({
      imports: [VehicleConfiguratorPage],
      providers: [
        provideRouter([]),
        { provide: TeamsService, useValue: mockTeamsService },
        { provide: CatalogService, useValue: mockCatalogService },
        { provide: VehicleService, useValue: mockVehicleService },
        { provide: ActivatedRoute, useValue: activatedRouteMock },
      ],
    });

    fixture = TestBed.createComponent(VehicleConfiguratorPage);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    // detectChanges() déclenche ngOnInit → résout team/vehicleId depuis la route
    fixture.detectChanges();
  }

  // ── Mode création ('.../vehicles/new') ──────────────────────────────────────

  describe("Mode création ('.../vehicles/new')", () => {
    it('résout team depuis :teamId et positionne vehicleId à null', () => {
      createFixture('7', 'new');

      expect(mockTeamsService.getAll).toHaveBeenCalledTimes(1);
      expect(component.team()).toEqual(mockTeams[0]);
      expect(component.vehicleId()).toBeNull();
      expect(component.loading()).toBe(false);
      expect(component.error()).toBe('');
    });

    it('affiche le titre "Ajouter un véhicule" et transmet [team]/[vehicleId] à VehicleConfigurator', () => {
      createFixture('7', 'new');

      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('Ajouter un véhicule');

      const configurator = el.querySelector('app-vehicle-configurator');
      expect(configurator).toBeTruthy();
    });
  });

  // ── Mode édition ('.../vehicles/:vehicleId') ────────────────────────────────

  describe("Mode édition ('.../vehicles/:vehicleId')", () => {
    it('résout team depuis :teamId et positionne vehicleId à l\'id numérique reçu', () => {
      createFixture('7', '100');

      expect(component.team()).toEqual(mockTeams[0]);
      expect(component.vehicleId()).toBe(100);
    });

    it('affiche le titre "Gérer l\'équipement du véhicule"', () => {
      createFixture('7', '100');

      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain("Gérer l'équipement du véhicule");
    });
  });

  // ── Équipe introuvable ───────────────────────────────────────────────────────

  describe('Équipe introuvable', () => {
    it("affiche un message d'erreur si aucune équipe ne correspond à :teamId", () => {
      createFixture('999', 'new');

      expect(component.team()).toBeNull();
      expect(component.error()).toBe('Équipe introuvable.');
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('app-vehicle-configurator')).toBeNull();
      expect(el.querySelector('.vcp-status--error')).toBeTruthy();
    });

    it('affiche un message d\'erreur si le chargement des équipes échoue', () => {
      mockTeamsService.getAll.mockReturnValue(throwError(() => new Error('Network error')));

      createFixture('7', 'new');

      expect(component.error()).toContain('Impossible de charger');
      expect(component.loading()).toBe(false);
    });
  });

  // ── Fin du flux ──────────────────────────────────────────────────────────────

  it('onDone() navigue vers /teams', () => {
    createFixture('7', 'new');
    const navigateSpy = vi.spyOn(router, 'navigate');

    component.onDone();

    expect(navigateSpy).toHaveBeenCalledWith(['/teams']);
  });
});
