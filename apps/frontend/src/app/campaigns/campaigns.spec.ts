/**
 * Tests unitaires pour le composant orchestrateur Campaigns.
 *
 * Campaigns est un composant "smart" qui délègue l'affichage à CampaignCard et
 * CampaignForm. On teste ici uniquement son rôle d'orchestration :
 * - Chargement initial des saisons (CampaignsService) et des équipes (TeamsService)
 * - Ouverture/fermeture du formulaire de création
 * - Appel à create() puis rechargement de la liste
 * - Gestion des erreurs API
 *
 * Pas de provideRouter nécessaire : Campaigns ne navigue pas (cf. teams.spec.ts
 * qui en a besoin pour VehicleConfigurator).
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Campaigns } from './campaigns';
import { CampaignsService } from './campaigns.service';
import { TeamsService } from '../teams/teams.service';
import { Campaign, CreateCampaignDto } from './campaign.model';
import { Team, CreateTeamDto } from '../teams/team.model';

const mockCampaigns: Campaign[] = [
  {
    id: 1,
    name: 'Coupe Verney',
    state: 'EN_CONSTRUCTION',
    inviteCode: 'abcdef123456',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    participantCount: 1,
    budget: 50,
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

describe('Campaigns Component', () => {
  let component: Campaigns;
  let fixture: ComponentFixture<Campaigns>;
  let mockCampaignsService: {
    getAll: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    getPending: ReturnType<typeof vi.fn>;
    getOrganizingPendingRequests: ReturnType<typeof vi.fn>;
  };
  let mockTeamsService: {
    getAll: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockCampaignsService = {
      getAll: vi.fn().mockReturnValue(of(mockCampaigns)),
      create: vi.fn(),
      getPending: vi.fn().mockReturnValue(of([])),
      getOrganizingPendingRequests: vi.fn().mockReturnValue(of([])),
    };

    mockTeamsService = {
      getAll: vi.fn().mockReturnValue(of(mockTeams)),
      create: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [Campaigns],
      providers: [
        { provide: CampaignsService, useValue: mockCampaignsService },
        { provide: TeamsService, useValue: mockTeamsService },
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Campaigns);
    component = fixture.componentInstance;
    // detectChanges() déclenche ngOnInit → charge saisons + équipes
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  // ── Chargement initial ───────────────────────────────────────────────────

  it('charge les saisons et les équipes au démarrage', () => {
    expect(mockCampaignsService.getAll).toHaveBeenCalledTimes(1);
    expect(mockTeamsService.getAll).toHaveBeenCalledTimes(1);
    expect(component.campaigns()).toEqual(mockCampaigns);
    expect(component.userTeams()).toEqual(mockTeams);
    expect(component.loading()).toBe(false);
  });

  // ── Saisons en attente (US4) ────────────────────────────────────────────

  it('charge les ids des saisons en attente de validation au démarrage', () => {
    expect(mockCampaignsService.getPending).toHaveBeenCalledTimes(1);
    expect(component.pendingCampaignIds()).toEqual(new Set());
  });

  it('expose les ids des saisons retournées par getPending()', async () => {
    mockCampaignsService.getPending.mockReturnValue(of([{ ...mockCampaigns[0], id: 5 }]));

    component['loadPendingRequests']();

    expect(component.pendingCampaignIds()).toEqual(new Set([5]));
  });

  it('ignore l\'erreur de getPending() (badge secondaire)', () => {
    mockCampaignsService.getPending.mockReturnValue(throwError(() => new Error('fail')));

    component['loadPendingRequests']();

    expect(component.pendingCampaignIds()).toEqual(new Set());
  });

  it('expose les pendingRequestsCount des saisons organisées', () => {
    mockCampaignsService.getOrganizingPendingRequests.mockReturnValue(
      of([{ ...mockCampaigns[0], id: 1, pendingRequestsCount: 2 }]),
    );

    component['loadOrganizedPendingCounts']();

    expect(component.organizedPendingCounts().get(1)).toBe(2);
  });

  it('ignore l\'erreur de getOrganizingPendingRequests() (badge secondaire)', () => {
    mockCampaignsService.getOrganizingPendingRequests.mockReturnValue(throwError(() => new Error('fail')));

    component['loadOrganizedPendingCounts']();

    expect(component.organizedPendingCounts()).toEqual(new Map());
  });

  it('affiche un message d\'erreur si le chargement des saisons échoue', () => {
    mockCampaignsService.getAll.mockReturnValue(throwError(() => new Error('fail')));

    component.loadCampaigns();

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

  it('crée une saison puis navigue vers le détail et ferme le formulaire', () => {
    const newCampaign: Campaign = { ...mockCampaigns[0], id: 2, name: 'Coupe Slime' };
    mockCampaignsService.create.mockReturnValue(of(newCampaign));
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');
    component.openCreate();

    const dto: CreateCampaignDto = { name: 'Coupe Slime', teamId: 7 };
    component.onSaved(dto);

    expect(mockCampaignsService.create).toHaveBeenCalledWith(dto);
    expect(component.showForm()).toBe(false);
    expect(component.saving()).toBe(false);
    expect(navigateSpy).toHaveBeenCalledWith(['/campaigns', 2]);
    // getAll n'est appelé qu'une seule fois (chargement initial)
    expect(mockCampaignsService.getAll).toHaveBeenCalledTimes(1);
  });

  it('affiche un message d\'erreur si la création échoue', () => {
    mockCampaignsService.create.mockReturnValue(throwError(() => new Error('fail')));
    component.openCreate();

    component.onSaved({ name: 'Coupe Slime', teamId: 7 });

    expect(component.error()).toContain('Une erreur est survenue');
    expect(component.saving()).toBe(false);
    expect(component.showForm()).toBe(true);
  });

  // ── Création rapide d'équipe (QuickTeamCreate, depuis CampaignForm) ────────

  describe('onTeamCreated()', () => {
    it('ajoute la nouvelle équipe à userTeams', () => {
      const newTeam: Team = {
        id: 9,
        name: 'Équipe du Vendredi',
        sponsor: 'Rutherford',
        cans: 50,
        userId: 42,
        createdAt: '2025-06-01T00:00:00.000Z',
        updatedAt: '2025-06-01T00:00:00.000Z',
      };
      mockTeamsService.create.mockReturnValue(of(newTeam));

      const dto: CreateTeamDto = { name: 'Équipe du Vendredi', sponsor: 'Rutherford', cans: 50 };
      component.onTeamCreated(dto);

      expect(mockTeamsService.create).toHaveBeenCalledWith(dto);
      expect(component.userTeams()).toEqual([...mockTeams, newTeam]);
      expect(component.creatingTeam()).toBe(false);
    });

    it('affiche un message d\'erreur en cas d\'échec de la création', () => {
      mockTeamsService.create.mockReturnValue(throwError(() => new Error('500')));

      component.onTeamCreated({ name: 'Équipe du Vendredi', sponsor: 'Rutherford', cans: 50 });

      expect(component.error()).toContain('création de l\'équipe');
      expect(component.creatingTeam()).toBe(false);
    });
  });

  // ── Rejoindre via code ────────────────────────────────────────────────────

  describe('goToJoin()', () => {
    it('navigue vers /campaigns/join/:code avec le code saisi', () => {
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate');

      component.joinCode.set('abcdef123456');
      component.goToJoin();

      expect(navigateSpy).toHaveBeenCalledWith(['/campaigns/join', 'abcdef123456']);
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
