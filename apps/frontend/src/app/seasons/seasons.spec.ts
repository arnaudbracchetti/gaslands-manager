/**
 * Tests unitaires pour le composant orchestrateur Seasons.
 *
 * Seasons est un composant "smart" qui délègue l'affichage à SeasonCard et
 * SeasonForm. On teste ici uniquement son rôle d'orchestration :
 * - Chargement initial des saisons (SeasonsService) et des équipes (TeamsService)
 * - Ouverture/fermeture du formulaire de création
 * - Appel à create() puis rechargement de la liste
 * - Gestion des erreurs API
 *
 * Pas de provideRouter nécessaire : Seasons ne navigue pas (cf. teams.spec.ts
 * qui en a besoin pour VehicleConfigurator).
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Seasons } from './seasons';
import { SeasonsService } from './seasons.service';
import { TeamsService } from '../teams/teams.service';
import { Season, CreateSeasonDto } from './season.model';
import { Team } from '../teams/team.model';

const mockSeasons: Season[] = [
  {
    id: 1,
    name: 'Coupe Verney',
    state: 'EN_CONSTRUCTION',
    inviteCode: 'abcdef123456',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    participantCount: 1,
    myRole: 'organizer',
  },
];

const mockTeams: Team[] = [
  {
    id: 7,
    name: 'Les Furieux du Désert',
    sponsor: 'Rutherford',
    cans: 50,
    userId: 42,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
];

describe('Seasons Component', () => {
  let component: Seasons;
  let fixture: ComponentFixture<Seasons>;
  let mockSeasonsService: {
    getAll: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    getPending: ReturnType<typeof vi.fn>;
    getOrganizingPendingRequests: ReturnType<typeof vi.fn>;
  };
  let mockTeamsService: {
    getAll: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockSeasonsService = {
      getAll: vi.fn().mockReturnValue(of(mockSeasons)),
      create: vi.fn(),
      getPending: vi.fn().mockReturnValue(of([])),
      getOrganizingPendingRequests: vi.fn().mockReturnValue(of([])),
    };

    mockTeamsService = {
      getAll: vi.fn().mockReturnValue(of(mockTeams)),
    };

    await TestBed.configureTestingModule({
      imports: [Seasons],
      providers: [
        { provide: SeasonsService, useValue: mockSeasonsService },
        { provide: TeamsService, useValue: mockTeamsService },
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Seasons);
    component = fixture.componentInstance;
    // detectChanges() déclenche ngOnInit → charge saisons + équipes
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  // ── Chargement initial ───────────────────────────────────────────────────

  it('charge les saisons et les équipes au démarrage', () => {
    expect(mockSeasonsService.getAll).toHaveBeenCalledTimes(1);
    expect(mockTeamsService.getAll).toHaveBeenCalledTimes(1);
    expect(component.seasons()).toEqual(mockSeasons);
    expect(component.userTeams()).toEqual(mockTeams);
    expect(component.loading()).toBe(false);
  });

  // ── Saisons en attente (US4) ────────────────────────────────────────────

  it('charge les ids des saisons en attente de validation au démarrage', () => {
    expect(mockSeasonsService.getPending).toHaveBeenCalledTimes(1);
    expect(component.pendingSeasonIds()).toEqual(new Set());
  });

  it('expose les ids des saisons retournées par getPending()', async () => {
    mockSeasonsService.getPending.mockReturnValue(of([{ ...mockSeasons[0], id: 5 }]));

    component['loadPendingRequests']();

    expect(component.pendingSeasonIds()).toEqual(new Set([5]));
  });

  it('ignore l\'erreur de getPending() (badge secondaire)', () => {
    mockSeasonsService.getPending.mockReturnValue(throwError(() => new Error('fail')));

    component['loadPendingRequests']();

    expect(component.pendingSeasonIds()).toEqual(new Set());
  });

  it('expose les pendingRequestsCount des saisons organisées', () => {
    mockSeasonsService.getOrganizingPendingRequests.mockReturnValue(
      of([{ ...mockSeasons[0], id: 1, pendingRequestsCount: 2 }]),
    );

    component['loadOrganizedPendingCounts']();

    expect(component.organizedPendingCounts().get(1)).toBe(2);
  });

  it('ignore l\'erreur de getOrganizingPendingRequests() (badge secondaire)', () => {
    mockSeasonsService.getOrganizingPendingRequests.mockReturnValue(throwError(() => new Error('fail')));

    component['loadOrganizedPendingCounts']();

    expect(component.organizedPendingCounts()).toEqual(new Map());
  });

  it('affiche un message d\'erreur si le chargement des saisons échoue', () => {
    mockSeasonsService.getAll.mockReturnValue(throwError(() => new Error('fail')));

    component.loadSeasons();

    expect(component.error()).toContain('Impossible de charger');
    expect(component.loading()).toBe(false);
  });

  // ── Ouverture/fermeture du formulaire ───────────────────────────────────

  it('ouvre puis ferme le formulaire de création', () => {
    expect(component.showForm()).toBe(false);

    component.openCreate();
    expect(component.showForm()).toBe(true);

    component.cancelForm();
    expect(component.showForm()).toBe(false);
  });

  // ── Création d'une saison ────────────────────────────────────────────────

  it('crée une saison puis recharge la liste et ferme le formulaire', () => {
    const newSeason: Season = { ...mockSeasons[0], id: 2, name: 'Coupe Slime' };
    mockSeasonsService.create.mockReturnValue(of(newSeason));
    component.openCreate();

    const dto: CreateSeasonDto = { name: 'Coupe Slime', teamId: 7 };
    component.onSaved(dto);

    expect(mockSeasonsService.create).toHaveBeenCalledWith(dto);
    expect(component.showForm()).toBe(false);
    expect(component.saving()).toBe(false);
    // loadSeasons a été appelé une deuxième fois (1 initial + 1 après création)
    expect(mockSeasonsService.getAll).toHaveBeenCalledTimes(2);
  });

  it('affiche un message d\'erreur si la création échoue', () => {
    mockSeasonsService.create.mockReturnValue(throwError(() => new Error('fail')));
    component.openCreate();

    component.onSaved({ name: 'Coupe Slime', teamId: 7 });

    expect(component.error()).toContain('Une erreur est survenue');
    expect(component.saving()).toBe(false);
    expect(component.showForm()).toBe(true);
  });

  // ── Rejoindre via code ────────────────────────────────────────────────────

  describe('goToJoin()', () => {
    it('navigue vers /seasons/join/:code avec le code saisi', () => {
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate');

      component.joinCode.set('abcdef123456');
      component.goToJoin();

      expect(navigateSpy).toHaveBeenCalledWith(['/seasons/join', 'abcdef123456']);
    });

    it('ne navigue pas si le code est vide', () => {
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate');

      component.joinCode.set('   ');
      component.goToJoin();

      expect(navigateSpy).not.toHaveBeenCalled();
    });
  });
});
