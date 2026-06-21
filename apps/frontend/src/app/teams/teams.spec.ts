/**
 * Tests unitaires pour le composant Teams (liste des équipes).
 *
 * Teams est désormais un composant "smart" allégé qui orchestre :
 * - Le chargement de la liste des équipes
 * - La création immédiate d'une nouvelle équipe (sans modale) et la redirection
 *   vers TeamEditPage
 * - La navigation vers TeamEditPage au clic sur une carte
 * - La construction des résumés de véhicules (vehicleSummaries)
 *
 * L'édition, la suppression et la gestion des véhicules sont déléguées
 * à TeamEditPage (/teams/:id/edit).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Teams } from './teams';
import { TeamsService } from './teams.service';
import { Team } from './team.model';
import { CatalogService } from '../catalog/catalog.service';
import { VehicleService } from './vehicle-configurator/vehicle.service';
import { Vehicle } from './vehicle-configurator/vehicle-builder.model';
import { Sponsor } from '../catalog/catalog.model';

const mockTeams: Team[] = [
  {
    id: 1,
    name: 'Les Furieux du Désert',
    sponsor: 'Rutherford',
    cans: 50,
    userId: 42,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 2,
    name: 'Brigade de l\'Asphalte',
    sponsor: 'Miyazaki',
    cans: 60,
    userId: 42,
    createdAt: '2025-01-02T00:00:00.000Z',
    updatedAt: '2025-01-02T00:00:00.000Z',
  },
];

const mockSponsorCatalog: Sponsor = {
  nom: 'Rutherford',
  description: '',
  classes_avantage: [],
  avantages_sponsorises: '',
  vehicules: [
    {
      nom: 'Camion',
      nom_interne: 'camion',
      poids: 'Moyen',
      carrosserie: 0,
      manoeuvrabilite: 0,
      vitesse_max: 0,
      equipage: 0,
      emplacements: 3,
      prix: 15,
      description: '',
      regles: '',
      sponsors_autorises: [],
    },
  ],
  armes: [],
  ameliorations: [],
};

const mockVehicle: Vehicle = {
  id: 1,
  nomInterne: 'camion',
  teamId: 10,
  improvements: [],
  weapons: [],
  createdAt: '2025-01-01T00:00:00.000Z',
};

describe('Teams Component', () => {
  let component: Teams;
  let fixture: ComponentFixture<Teams>;
  let mockTeamsService: {
    getAll: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let mockCatalogService: {
    getSponsors: ReturnType<typeof vi.fn>;
    getSponsorByName: ReturnType<typeof vi.fn>;
  };
  let mockVehicleService: {
    create: ReturnType<typeof vi.fn>;
    getAvailableWeapons: ReturnType<typeof vi.fn>;
    getAvailableImprovements: ReturnType<typeof vi.fn>;
    addWeapon: ReturnType<typeof vi.fn>;
    addImprovement: ReturnType<typeof vi.fn>;
    getAllForTeam: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    removeWeapon: ReturnType<typeof vi.fn>;
    removeImprovement: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockTeamsService = {
      getAll: vi.fn().mockReturnValue(of(mockTeams)),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };

    mockCatalogService = {
      getSponsors: vi.fn().mockReturnValue(of([])),
      getSponsorByName: vi.fn().mockReturnValue(of(mockSponsorCatalog)),
    };

    mockVehicleService = {
      create: vi.fn(),
      getAvailableWeapons: vi.fn().mockReturnValue(of([])),
      getAvailableImprovements: vi.fn().mockReturnValue(of([])),
      addWeapon: vi.fn(),
      addImprovement: vi.fn(),
      getAllForTeam: vi.fn().mockReturnValue(of([])),
      remove: vi.fn(),
      removeWeapon: vi.fn(),
      removeImprovement: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [Teams],
      providers: [
        provideRouter([]),
        { provide: TeamsService, useValue: mockTeamsService },
        { provide: CatalogService, useValue: mockCatalogService },
        { provide: VehicleService, useValue: mockVehicleService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Teams);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  // ── Chargement initial ─────────────────────────────────────────────────────

  it('appelle TeamsService.getAll() au démarrage', () => {
    expect(mockTeamsService.getAll).toHaveBeenCalledTimes(1);
  });

  it('affiche les cartes des équipes après chargement', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const cards = compiled.querySelectorAll('app-team-card');
    expect(cards.length).toBe(2);
    expect(compiled.textContent).toContain('Les Furieux du Désert');
    expect(compiled.textContent).toContain('Brigade de l\'Asphalte');
  });

  // ── État vide ──────────────────────────────────────────────────────────────

  it('affiche un message d\'état vide si aucune équipe', () => {
    mockTeamsService.getAll.mockReturnValue(of([]));

    component.ngOnInit();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.teams-empty')).toBeTruthy();
    expect(compiled.textContent).toContain('Aucune équipe');
  });

  // ── Création immédiate d'une équipe ───────────────────────────────────────

  it('createAndEdit() appelle getSponsors() puis create() et navigue vers l\'édition', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');
    const sponsorList = [{ nom: 'Rutherford' }];
    mockCatalogService.getSponsors.mockReturnValue(of(sponsorList));
    mockTeamsService.create.mockReturnValue(of({ ...mockTeams[0], id: 99 }));

    component.createAndEdit();

    expect(mockTeamsService.create).toHaveBeenCalledWith({
      name: 'Nouvelle équipe',
      sponsor: 'Rutherford',
      cans: 50,
    });
    expect(navigateSpy).toHaveBeenCalledWith(
      ['/teams', 99, 'edit'],
      { queryParams: { from: 'teams' } },
    );
  });

  it('createAndEdit() affiche une erreur si la création échoue', () => {
    mockCatalogService.getSponsors.mockReturnValue(of([{ nom: 'Rutherford' }]));
    mockTeamsService.create.mockReturnValue(throwError(() => new Error('API error')));

    component.createAndEdit();

    expect(component.error()).toContain('erreur');
  });

  // ── Navigation vers TeamEditPage ───────────────────────────────────────────

  it('navigue vers /teams/:id/edit avec from=teams au clic sur une carte', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    component.navigateToEdit(mockTeams[0]);

    expect(navigateSpy).toHaveBeenCalledWith(
      ['/teams', mockTeams[0].id, 'edit'],
      { queryParams: { from: 'teams' } },
    );
  });

  // ── Gestion d'erreur ───────────────────────────────────────────────────────

  it('affiche un message d\'erreur si le chargement échoue', () => {
    mockTeamsService.getAll.mockReturnValue(throwError(() => new Error('Network error')));

    component.ngOnInit();
    fixture.detectChanges();

    expect(component.error()).toContain('Impossible de charger');

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.teams-error')).toBeTruthy();
  });

  // ── Résumés des véhicules ──────────────────────────────────────────────────

  describe('Résumés des véhicules sur les cartes', () => {
    const teamWithVehicles: Team = { ...mockTeams[0], id: 10, sponsor: 'Rutherford', vehicleCount: 1 };
    const teamWithoutVehicles: Team = { ...mockTeams[1], id: 11, vehicleCount: 0 };

    it('charge véhicules + catalogue uniquement pour les équipes avec vehicleCount > 0', () => {
      mockTeamsService.getAll.mockReturnValue(of([teamWithVehicles, teamWithoutVehicles]));
      mockVehicleService.getAllForTeam.mockReturnValue(of([mockVehicle]));

      component.loadTeams();

      expect(mockVehicleService.getAllForTeam).toHaveBeenCalledTimes(1);
      expect(mockVehicleService.getAllForTeam).toHaveBeenCalledWith(10);
      expect(mockCatalogService.getSponsorByName).toHaveBeenCalledWith('Rutherford');
    });

    it('peuple vehicleSummaries avec le résumé construit', () => {
      mockTeamsService.getAll.mockReturnValue(of([teamWithVehicles]));
      mockVehicleService.getAllForTeam.mockReturnValue(of([mockVehicle]));

      component.loadTeams();

      const summaries = component.vehicleSummaries().get(10);
      expect(summaries).toHaveLength(1);
      expect(summaries?.[0]).toMatchObject({ id: 1, nom: 'Camion', cout: 15 });
    });

    it('ne fait aucun appel si aucune équipe n\'a de véhicule', () => {
      mockTeamsService.getAll.mockReturnValue(of([teamWithoutVehicles]));

      component.loadTeams();

      expect(mockVehicleService.getAllForTeam).not.toHaveBeenCalled();
      expect(component.vehicleSummaries().size).toBe(0);
    });

    it('isole les équipes en erreur (résilience)', () => {
      const otherTeam: Team = { ...mockTeams[1], id: 20, sponsor: 'Idris', vehicleCount: 1 };
      mockTeamsService.getAll.mockReturnValue(of([teamWithVehicles, otherTeam]));
      mockVehicleService.getAllForTeam.mockReturnValue(of([mockVehicle]));
      mockCatalogService.getSponsorByName.mockImplementation((nom: string) =>
        nom === 'Rutherford' ? throwError(() => new Error('Sponsor introuvable')) : of(mockSponsorCatalog),
      );

      component.loadTeams();

      expect(component.vehicleSummaries().get(10)).toEqual([]);
      expect(component.vehicleSummaries().get(20)).toHaveLength(1);
    });
  });
});
