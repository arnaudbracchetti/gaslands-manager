/**
 * Tests unitaires pour le composant orchestrateur Teams.
 *
 * Teams est désormais un composant "smart" qui délègue l'affichage
 * à TeamCard et TeamForm. On teste ici uniquement son rôle d'orchestration :
 * - Chargement de la liste via TeamsService
 * - Contrôle de la visibilité du formulaire
 * - Appel au service lors de onSaved() et deleteTeam()
 * - Gestion des erreurs API
 *
 * Les tests du comportement interne des cartes et du formulaire
 * sont dans leurs specs respectives :
 *   - team-card/team-card.spec.ts
 *   - team-form/team-form.spec.ts
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Teams } from './teams';
import { TeamsService } from './teams.service';
import { Team, CreateTeamDto } from './team.model';
// CatalogService et VehicleService : injectés par VehicleBuilder, lui-même rendu
// dans la modale dès que `buildingTeam` est non-nul (cf. teams.html). On les mocke
// ici pour la même raison que `team-form.spec.ts` mocke CatalogService — éviter
// d'injecter HttpClient (aucun provideHttpClient dans ce module de test : Teams
// n'en a normalement pas besoin, c'est VehicleBuilder qui l'entraîne avec lui).
import { CatalogService } from '../catalog/catalog.service';
import { VehicleService } from './vehicle-builder/vehicle.service';
import { VehicleBuilder } from './vehicle-builder/vehicle-builder';
import { Vehicle } from './vehicle-builder/vehicle-builder.model';
import { Sponsor } from '../catalog/catalog.model';

// Équipes fictives
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

// Catalogue renvoyé au VehicleBuilder lors de son chargement initial
// (ngOnInit → getSponsorByName) — MAIS aussi à `loadVehicleSummaries` (cf.
// "Résumés des véhicules" plus bas), qui en a besoin pour résoudre `nomInterne →
// {nom, prix}` (cf. `buildVehicleSummary`). D'où la présence d'un véhicule
// catalogue ("camion") : sans lui, ces deux familles de tests ne pourraient
// pas partager le même mock — `getSponsorByName` est mocké UNE SEULE FOIS pour
// tout le module (cf. `mockCatalogService` ci-dessous, même raisonnement que
// `mockSponsorCatalog` pour `VehicleBuilder`).
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

// Véhicule fictif "nu" — réponse fictive de GET /api/teams/:teamId/vehicles,
// résolu par `buildVehicleSummary` via `mockSponsorCatalog.vehicules` ci-dessus
// (nomInterne 'camion' → nom 'Camion', prix 15).
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
  // Variables nommées (plutôt qu'objets inline dans `providers`) — nécessaire
  // pour pouvoir reconfigurer `mockReturnValue`/`mockImplementation` AU CAS PAR
  // CAS dans la section "Résumés des véhicules" (cf. plus bas), exactement
  // comme `mockTeamsService` l'est déjà pour les tests de chargement/sauvegarde.
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
  };

  beforeEach(async () => {
    mockTeamsService = {
      getAll: vi.fn().mockReturnValue(of(mockTeams)),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };

    // ⚠️ CatalogService est substitué pour TOUT le module de test — y compris
    // pour TeamForm (rendu quand showForm() est vrai), qui appelle `getSponsors()`
    // (cf. son ngOnInit). D'où la présence des DEUX méthodes ici : `getSponsors`
    // (mirroir de `mockCatalogService` dans team-form.spec.ts — tableau vide,
    // suffisant pour ce composant qui n'est pas l'objet de CES tests) et
    // `getSponsorByName` (utilisée par VehicleBuilder ET par `loadVehicleSummaries`,
    // cf. doc de `mockSponsorCatalog` ci-dessus).
    mockCatalogService = {
      getSponsors: vi.fn().mockReturnValue(of([])),
      getSponsorByName: vi.fn().mockReturnValue(of(mockSponsorCatalog)),
    };

    // VehicleService : injecté par VehicleBuilder (5 premières méthodes, cf.
    // teams.spec.ts plus haut) ET par `loadVehicleSummaries` via `getAllForTeam`
    // (cf. en-tête de `vehicle.service.ts` — "sixième méthode, hors flux").
    // Valeur par défaut `of([])` : suffisante pour les tests qui ne portent PAS
    // sur les résumés (équipes sans véhicule par défaut, cf. `mockTeams`).
    mockVehicleService = {
      create: vi.fn(),
      getAvailableWeapons: vi.fn().mockReturnValue(of([])),
      getAvailableImprovements: vi.fn().mockReturnValue(of([])),
      addWeapon: vi.fn(),
      addImprovement: vi.fn(),
      getAllForTeam: vi.fn().mockReturnValue(of([])),
    };

    await TestBed.configureTestingModule({
      // Le composant est standalone → on l'importe directement.
      // TeamCard, TeamForm, Modal et VehicleBuilder seront rendus dans le DOM
      // (test d'intégration légère, cf. les deux mocks ci-dessous pour VehicleBuilder).
      imports: [Teams],
      providers: [
        provideRouter([]),
        { provide: TeamsService, useValue: mockTeamsService },
        // VehicleBuilder (rendu dans la modale dès que `buildingTeam` est non-nul)
        // ET `Teams` lui-même (via `loadVehicleSummaries`) injectent CatalogService/
        // VehicleService — mockés pour éviter HttpClient (cf. déclarations ci-dessus
        // pour le détail de chaque mock, partagé entre les deux usages).
        { provide: CatalogService, useValue: mockCatalogService },
        { provide: VehicleService, useValue: mockVehicleService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Teams);
    component = fixture.componentInstance;
    // detectChanges() déclenche ngOnInit → charge les équipes
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  // ── Chargement initial ─────────────────────────────────────────────────────

  it('appelle TeamsService.getAll() au démarrage', () => {
    expect(mockTeamsService.getAll).toHaveBeenCalledTimes(1);
  });

  it('affiche les cartes des équipes après chargement', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    // Les cartes sont rendues par TeamCard — on vérifie les sélecteurs du composant
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

  // ── Contrôle du formulaire ─────────────────────────────────────────────────

  it('n\'affiche pas le formulaire au démarrage', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-team-form')).toBeNull();
  });

  it('affiche le formulaire au clic sur "Nouvelle équipe"', () => {
    component.openCreate();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-team-form')).toBeTruthy();
  });

  it('masque le formulaire au clic sur "Annuler"', () => {
    component.openCreate();
    fixture.detectChanges();

    component.cancelForm();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-team-form')).toBeNull();
  });

  it('openCreate() positionne editingTeam à null et showForm à true', () => {
    component.openCreate();
    expect(component.editingTeam()).toBeNull();
    expect(component.showForm()).toBe(true);
  });

  it('openEdit(team) positionne editingTeam et showForm à true', () => {
    component.openEdit(mockTeams[0]);
    expect(component.editingTeam()).toEqual(mockTeams[0]);
    expect(component.showForm()).toBe(true);
  });

  // ── Sauvegarde (onSaved) ───────────────────────────────────────────────────

  it('appelle create() quand onSaved() est appelé en mode création', () => {
    mockTeamsService.create.mockReturnValue(of(mockTeams[0]));
    mockTeamsService.getAll.mockReturnValue(of(mockTeams));

    component.openCreate(); // editingTeam = null
    const dto: CreateTeamDto = { name: 'Nouvelle', sponsor: 'Idris', cans: 50 };
    component.onSaved(dto);

    expect(mockTeamsService.create).toHaveBeenCalledWith(dto);
    expect(mockTeamsService.update).not.toHaveBeenCalled();
  });

  it('appelle update() quand onSaved() est appelé en mode édition', () => {
    mockTeamsService.update.mockReturnValue(of(mockTeams[0]));
    mockTeamsService.getAll.mockReturnValue(of(mockTeams));

    component.openEdit(mockTeams[0]); // editingTeam = mockTeams[0]
    const dto: CreateTeamDto = { name: 'Modifiée', sponsor: 'Idris', cans: 50 };
    component.onSaved(dto);

    expect(mockTeamsService.update).toHaveBeenCalledWith(1, dto);
    expect(mockTeamsService.create).not.toHaveBeenCalled();
  });

  it('ferme le formulaire après une sauvegarde réussie', () => {
    mockTeamsService.create.mockReturnValue(of(mockTeams[0]));
    mockTeamsService.getAll.mockReturnValue(of(mockTeams));

    component.openCreate();
    component.onSaved({ name: 'Test', sponsor: 'Rutherford', cans: 50 });
    fixture.detectChanges();

    expect(component.showForm()).toBe(false);
    expect(component.editingTeam()).toBeNull();
  });

  it('affiche une erreur API si la sauvegarde échoue', () => {
    mockTeamsService.create.mockReturnValue(throwError(() => new Error('API error')));

    component.openCreate();
    component.onSaved({ name: 'Test', sponsor: 'Rutherford', cans: 50 });

    expect(component.error()).toContain('erreur');
    expect(component.showForm()).toBe(true); // le formulaire reste ouvert
  });

  // ── Suppression ────────────────────────────────────────────────────────────

  it('appelle TeamsService.remove() après confirmation et retire l\'équipe de la liste', () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    mockTeamsService.remove.mockReturnValue(of(undefined));

    component.deleteTeam(mockTeams[0]);

    expect(mockTeamsService.remove).toHaveBeenCalledWith(1);
    // La suppression optimiste retire immédiatement l'équipe du signal
    expect(component.teams().find((t) => t.id === 1)).toBeUndefined();

    vi.unstubAllGlobals();
  });

  it('n\'appelle pas remove() si l\'utilisateur annule la confirmation', () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));

    component.deleteTeam(mockTeams[0]);

    expect(mockTeamsService.remove).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  // ── Modale de construction de véhicule ─────────────────────────────────────

  it('n\'affiche pas la modale de construction de véhicule au démarrage', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(component.buildingTeam()).toBeNull();
    expect(compiled.querySelector('app-modal')).toBeNull();
    expect(compiled.querySelector('app-vehicle-builder')).toBeNull();
  });

  it('openVehicleBuilder(team) positionne buildingTeam et affiche la modale avec le builder', () => {
    component.openVehicleBuilder(mockTeams[0]);
    fixture.detectChanges();

    expect(component.buildingTeam()).toEqual(mockTeams[0]);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-modal')).toBeTruthy();
    expect(compiled.querySelector('app-vehicle-builder')).toBeTruthy();
  });

  it('le clic sur "Ajouter un véhicule" d\'une carte ouvre la modale pour l\'équipe correspondante', () => {
    // (addVehicleClicked) de la PREMIÈRE carte → openVehicleBuilder(mockTeams[0])
    // (cf. câblage dans teams.html, mirroir de editClicked/deleteClicked).
    const card = fixture.nativeElement.querySelector('app-team-card') as HTMLElement;
    const btn = card.querySelector('.btn-add-vehicle') as HTMLButtonElement;
    btn.click();
    fixture.detectChanges();

    expect(component.buildingTeam()).toEqual(mockTeams[0]);
  });

  it('closeVehicleBuilder() ferme la modale et recharge la liste des équipes', () => {
    component.openVehicleBuilder(mockTeams[0]);
    fixture.detectChanges();
    vi.clearAllMocks(); // ne compter que les appels déclenchés par la fermeture elle-même

    component.closeVehicleBuilder();
    fixture.detectChanges();

    expect(component.buildingTeam()).toBeNull();
    // cf. doc de closeVehicleBuilder : rechargement SYSTÉMATIQUE — `vehicleCount`
    // a pu changer dès l'étape 1 (persistance immédiate du véhicule "nu").
    expect(mockTeamsService.getAll).toHaveBeenCalledTimes(1);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-modal')).toBeNull();
  });

  it('ferme la modale et recharge la liste au (closeRequested) de la modale — abandon en cours de route', () => {
    component.openVehicleBuilder(mockTeams[0]);
    fixture.detectChanges();
    vi.clearAllMocks();

    // Croix de fermeture de la Modal (cf. modal.html, .modal-close) → closeRequested
    const closeBtn = fixture.nativeElement.querySelector('.modal-close') as HTMLButtonElement;
    closeBtn.click();
    fixture.detectChanges();

    expect(component.buildingTeam()).toBeNull();
    expect(mockTeamsService.getAll).toHaveBeenCalledTimes(1);
  });

  it('ferme la modale et recharge la liste au (finished) du builder — fin normale du flux', () => {
    component.openVehicleBuilder(mockTeams[0]);
    fixture.detectChanges();
    vi.clearAllMocks();

    // `VehicleBuilder.finish()` est indépendant de l'étape courante (cf. son
    // code : seule l'INTENTION de fermer compte) — on appelle directement la
    // méthode du builder projeté plutôt que de naviguer le flux complet
    // (étape 1 → 2 → "Terminer", déjà couvert par vehicle-builder.spec.ts) :
    // ce test vérifie l'orchestration de `Teams`, pas le builder lui-même.
    const builder = fixture.debugElement.query(By.directive(VehicleBuilder)).componentInstance as VehicleBuilder;
    builder.finish();
    fixture.detectChanges();

    expect(component.buildingTeam()).toBeNull();
    expect(mockTeamsService.getAll).toHaveBeenCalledTimes(1);
  });

  // ── Résumés des véhicules sur les cartes (vehicleSummaries) ────────────────
  // `loadVehicleSummaries` est privée — on l'observe à travers son EFFET
  // (le signal `vehicleSummaries` et les appels aux services mockés), jamais
  // en l'appelant directement (cf. convention `teams.spec.ts` : tester
  // l'orchestration via les points d'entrée publics, ici `loadTeams`).

  describe('Résumés des véhicules sur les cartes', () => {
    // `id: 10`/`11` : valeurs DISTINCTES de celles de `mockTeams` (1, 2) — on
    // évite toute ambiguïté avec les entrées par défaut de `getAll()` posées
    // dans `beforeEach` (qui, elles, n'ont pas de `vehicleCount` et ne doivent
    // déclencher AUCUN appel — cf. le test "ne fait aucun appel...").
    const teamWithVehicles: Team = { ...mockTeams[0], id: 10, sponsor: 'Rutherford', vehicleCount: 1 };
    const teamWithoutVehicles: Team = { ...mockTeams[1], id: 11, vehicleCount: 0 };

    it('charge véhicules + catalogue UNIQUEMENT pour les équipes avec vehicleCount > 0', () => {
      mockTeamsService.getAll.mockReturnValue(of([teamWithVehicles, teamWithoutVehicles]));
      mockVehicleService.getAllForTeam.mockReturnValue(of([mockVehicle]));

      component.loadTeams();

      // Une seule équipe qualifie (`vehicleCount: 1`) → un seul couple d'appels,
      // avec SES paramètres (id 10, sponsor "Rutherford") — pas ceux de l'équipe vide.
      expect(mockVehicleService.getAllForTeam).toHaveBeenCalledTimes(1);
      expect(mockVehicleService.getAllForTeam).toHaveBeenCalledWith(10);
      expect(mockCatalogService.getSponsorByName).toHaveBeenCalledWith('Rutherford');
      expect(mockCatalogService.getSponsorByName).not.toHaveBeenCalledWith(teamWithoutVehicles.sponsor);
    });

    it('peuple vehicleSummaries avec le résumé construit (nom + coût résolus depuis le catalogue)', () => {
      mockTeamsService.getAll.mockReturnValue(of([teamWithVehicles]));
      mockVehicleService.getAllForTeam.mockReturnValue(of([mockVehicle]));

      component.loadTeams();

      const summaries = component.vehicleSummaries().get(10);
      expect(summaries).toHaveLength(1);
      // 'camion' → 'Camion' (nom) / 15 (prix de base, cf. mockSponsorCatalog.vehicules)
      expect(summaries?.[0]).toEqual({ id: 1, nom: 'Camion', cout: 15, coutApproximatif: false });
    });

    it('ne fait AUCUN appel et laisse vehicleSummaries vide si aucune équipe n\'a de véhicule', () => {
      mockTeamsService.getAll.mockReturnValue(of([teamWithoutVehicles]));

      component.loadTeams();

      expect(mockVehicleService.getAllForTeam).not.toHaveBeenCalled();
      expect(mockCatalogService.getSponsorByName).not.toHaveBeenCalled();
      expect(component.vehicleSummaries().size).toBe(0);
    });

    it('isole les équipes en erreur (résilience) : une équipe en échec n\'empêche pas les autres de s\'afficher', () => {
      // cf. doc de `loadVehicleSummaries` : "le sponsor d'une équipe est introuvable
      // (incohérence de données) ou le réseau capricieux" — `catchError` PAR ÉQUIPE.
      const otherTeam: Team = { ...mockTeams[1], id: 20, sponsor: 'Idris', vehicleCount: 1 };
      mockTeamsService.getAll.mockReturnValue(of([teamWithVehicles, otherTeam]));
      mockVehicleService.getAllForTeam.mockReturnValue(of([mockVehicle]));
      mockCatalogService.getSponsorByName.mockImplementation((nom: string) =>
        nom === 'Rutherford' ? throwError(() => new Error('Sponsor introuvable')) : of(mockSponsorCatalog),
      );

      component.loadTeams();

      // Équipe 10 (Rutherford) : son chargement échoue → liste vide, PAS d'erreur globale
      expect(component.vehicleSummaries().get(10)).toEqual([]);
      // Équipe 20 (Idris) : son chargement réussit → résumé construit normalement
      expect(component.vehicleSummaries().get(20)).toHaveLength(1);
    });

    it('recharge les résumés à chaque loadTeams() — reflète vehicleCount après fermeture de la modale', () => {
      // cf. doc de `loadTeams` : "Toujours déclenché après un chargement réussi —
      // y compris après un simple rafraîchissement [...] vehicleCount a pu changer".
      mockTeamsService.getAll.mockReturnValue(of([teamWithoutVehicles]));
      component.loadTeams();
      expect(component.vehicleSummaries().size).toBe(0);

      // Le véhicule vient d'être ajouté → vehicleCount passe à 1 (rechargement simulé)
      mockTeamsService.getAll.mockReturnValue(of([{ ...teamWithoutVehicles, vehicleCount: 1 }]));
      mockVehicleService.getAllForTeam.mockReturnValue(of([mockVehicle]));
      component.loadTeams();

      expect(component.vehicleSummaries().get(11)).toHaveLength(1);
    });
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
});
