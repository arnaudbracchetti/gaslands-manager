/**
 * Tests unitaires pour SeasonJoin.
 *
 * Composant "smart" : on mocke SeasonsService et TeamsService (cf.
 * seasons.spec.ts), et ActivatedRoute pour fournir le paramètre `code`.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { SeasonJoin } from './season-join';
import { SeasonsService } from '../seasons.service';
import { TeamsService } from '../../teams/teams.service';
import { SeasonSummary } from '../season.model';
import { Team, CreateTeamDto } from '../../teams/team.model';

const mockSummary: SeasonSummary = {
  id: 1,
  name: 'Coupe Verney',
  state: 'EN_CONSTRUCTION',
  organizerName: 'Jean Dupont',
  participantCount: 3,
};

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

describe('SeasonJoin Component', () => {
  let component: SeasonJoin;
  let fixture: ComponentFixture<SeasonJoin>;
  let mockSeasonsService: {
    getByCode: ReturnType<typeof vi.fn>;
    requestJoin: ReturnType<typeof vi.fn>;
  };
  let mockTeamsService: {
    getAll: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockSeasonsService = {
      getByCode: vi.fn().mockReturnValue(of(mockSummary)),
      requestJoin: vi.fn(),
    };

    mockTeamsService = {
      getAll: vi.fn().mockReturnValue(of(mockTeams)),
      create: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [SeasonJoin],
      providers: [
        { provide: SeasonsService, useValue: mockSeasonsService },
        { provide: TeamsService, useValue: mockTeamsService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { params: { code: 'abcdef123456' } } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SeasonJoin);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  // ── Chargement initial ───────────────────────────────────────────────────

  it('charge le résumé de la saison et les équipes au démarrage', () => {
    expect(mockSeasonsService.getByCode).toHaveBeenCalledWith('abcdef123456');
    expect(component.summary()).toEqual(mockSummary);
    expect(component.userTeams()).toEqual(mockTeams);
    expect(component.selectedTeamId()).toBe(7);
    expect(component.loading()).toBe(false);
  });

  it('affiche un message d\'erreur générique si le code est invalide (CA2)', async () => {
    mockSeasonsService.getByCode.mockReturnValue(throwError(() => new Error('404')));

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [SeasonJoin],
      providers: [
        { provide: SeasonsService, useValue: mockSeasonsService },
        { provide: TeamsService, useValue: mockTeamsService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { params: { code: 'inconnu' } } },
        },
      ],
    }).compileComponents();

    const errorFixture = TestBed.createComponent(SeasonJoin);
    const errorComponent = errorFixture.componentInstance;
    errorFixture.detectChanges();

    expect(errorComponent.error()).toContain('Code d\'invitation invalide');
    expect(errorComponent.summary()).toBeNull();
    expect(errorComponent.loading()).toBe(false);
  });

  // ── Soumission de la demande ─────────────────────────────────────────────

  describe('submitJoinRequest()', () => {
    it('envoie la demande puis affiche un message de confirmation', () => {
      mockSeasonsService.requestJoin.mockReturnValue(of({}));

      component.submitJoinRequest();

      expect(mockSeasonsService.requestJoin).toHaveBeenCalledWith(mockSummary.id, { teamId: 7 });
      expect(component.submitted()).toBe(true);
      expect(component.submitting()).toBe(false);
    });

    it('affiche le message d\'erreur du backend en cas de rejet (CA4/CA5)', () => {
      mockSeasonsService.requestJoin.mockReturnValue(
        throwError(() => ({ error: { message: 'Vous avez déjà une demande d\'inscription pour cette saison.' } })),
      );

      component.submitJoinRequest();

      expect(component.submitError()).toBe('Vous avez déjà une demande d\'inscription pour cette saison.');
      expect(component.submitted()).toBe(false);
      expect(component.submitting()).toBe(false);
    });

    it('ne fait rien si aucune équipe n\'est sélectionnée', () => {
      component.selectedTeamId.set(null);

      component.submitJoinRequest();

      expect(mockSeasonsService.requestJoin).not.toHaveBeenCalled();
    });
  });

  // ── Création rapide d'équipe (QuickTeamCreate) ───────────────────────────

  describe('onTeamCreated()', () => {
    it('ajoute la nouvelle équipe à la liste et la sélectionne', () => {
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
      expect(component.selectedTeamId()).toBe(9);
      expect(component.creatingTeam()).toBe(false);
    });

    it('affiche un message d\'erreur en cas d\'échec de la création', () => {
      mockTeamsService.create.mockReturnValue(throwError(() => new Error('500')));

      component.onTeamCreated({ name: 'Équipe du Vendredi', sponsor: 'Rutherford', cans: 50 });

      expect(component.submitError()).toContain('création de l\'équipe');
      expect(component.creatingTeam()).toBe(false);
    });
  });
});
