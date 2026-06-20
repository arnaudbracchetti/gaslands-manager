/**
 * Tests unitaires pour SeasonDetail.
 *
 * Composant "smart" : on mocke SeasonsService.
 * Le composant utilise désormais une liste de participants unifiée (tous statuts)
 * et une carte d'état pour les transitions de saison.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { SeasonDetail } from './season-detail';
import { SeasonsService } from '../seasons.service';
import { Season } from '../season.model';
import { SeasonParticipant } from '../season-participant.model';
import { AuthService } from '../../auth/auth.service';
import { User } from '../../auth/auth.model';

const mockSeason: Season = {
  id: 1,
  name: 'Coupe Verney',
  state: 'EN_CONSTRUCTION',
  inviteCode: 'abcdef123456',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  participantCount: 2,
  myRole: 'organizer',
};

const mockCurrentUser: User = {
  id: 42,
  firstName: 'Jean',
  lastName: 'Dupont',
  email: 'jean@example.com',
  role: 'user',
  isActive: true,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const mockParticipants: SeasonParticipant[] = [
  { id: 1, userId: 42, teamId: 7, status: 'VALIDATED', isOrganizer: true, userName: 'Jean Dupont', teamName: 'Furies' },
  { id: 2, userId: 43, teamId: 8, status: 'PENDING', isOrganizer: false, userName: 'Alice Martin', teamName: 'Scrap Kings' },
  { id: 3, userId: 44, teamId: 10, status: 'VALIDATED', isOrganizer: false, userName: 'Bob Martin', teamName: 'Bandits' },
  { id: 4, userId: 45, teamId: 11, status: 'REJECTED', isOrganizer: false, userName: 'Dan Fury', teamName: 'Outlaws' },
];

describe('SeasonDetail', () => {
  let component: SeasonDetail;
  let fixture: ComponentFixture<SeasonDetail>;
  let mockSeasonsService: {
    getOne: ReturnType<typeof vi.fn>;
    getParticipants: ReturnType<typeof vi.fn>;
    validateParticipant: ReturnType<typeof vi.fn>;
    removeParticipant: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    changeState: ReturnType<typeof vi.fn>;
    promote: ReturnType<typeof vi.fn>;
  };
  let mockAuthService: { currentUser: ReturnType<typeof signal<User | null>> };
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };

  function configure(seasonId = '1'): void {
    TestBed.configureTestingModule({
      imports: [SeasonDetail],
      providers: [
        provideRouter([]),
        { provide: SeasonsService, useValue: mockSeasonsService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: { snapshot: { params: { id: seasonId } } } },
      ],
    });
  }

  beforeEach(() => {
    mockSeasonsService = {
      getOne: vi.fn().mockReturnValue(of(mockSeason)),
      getParticipants: vi.fn().mockReturnValue(of(mockParticipants)),
      validateParticipant: vi.fn(),
      removeParticipant: vi.fn(),
      remove: vi.fn(),
      changeState: vi.fn(),
      promote: vi.fn(),
    };
    mockAuthService = { currentUser: signal<User | null>(mockCurrentUser) };
    mockRouter = { navigate: vi.fn() };
  });

  afterEach(() => vi.clearAllMocks());

  // ── Chargement initial ───────────────────────────────────────────────────

  it('charge la saison et ses participants au démarrage', () => {
    configure();
    fixture = TestBed.createComponent(SeasonDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(mockSeasonsService.getOne).toHaveBeenCalledWith(1);
    expect(mockSeasonsService.getParticipants).toHaveBeenCalledWith(1);
    expect(component.season()).toEqual(mockSeason);
    expect(component.loading()).toBe(false);
    expect(component.participants()).toEqual(mockParticipants);
  });

  it('myParticipant correspond au participant de l\'utilisateur connecté', () => {
    configure();
    fixture = TestBed.createComponent(SeasonDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.myParticipant()).toEqual(mockParticipants[0]);
  });

  it('validatedCount et pendingCount reflètent les statuts des participants', () => {
    configure();
    fixture = TestBed.createComponent(SeasonDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.validatedCount()).toBe(2); // Jean + Bob
    expect(component.pendingCount()).toBe(1);   // Alice
  });

  it('affiche un message d\'erreur générique si la saison est introuvable (CA3)', () => {
    mockSeasonsService.getOne.mockReturnValue(throwError(() => new Error('404')));

    configure();
    fixture = TestBed.createComponent(SeasonDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.error()).not.toBe('');
    expect(component.season()).toBeNull();
    expect(component.loading()).toBe(false);
  });

  // ── isOrganizer ──────────────────────────────────────────────────────────

  it('isOrganizer est vrai quand myRole === "organizer"', () => {
    configure();
    fixture = TestBed.createComponent(SeasonDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.isOrganizer()).toBe(true);
  });

  it('isOrganizer est faux quand myRole === "participant"', () => {
    mockSeasonsService.getOne.mockReturnValue(of({ ...mockSeason, myRole: 'participant' }));

    configure();
    fixture = TestBed.createComponent(SeasonDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.isOrganizer()).toBe(false);
  });

  // ── onValidate ───────────────────────────────────────────────────────────

  describe('onValidate()', () => {
    it('met à jour le participant localement sans recharger la liste', () => {
      const updated: SeasonParticipant = { ...mockParticipants[1], status: 'VALIDATED' };
      mockSeasonsService.validateParticipant.mockReturnValue(of(updated));

      configure();
      fixture = TestBed.createComponent(SeasonDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.onValidate({ pid: 2, accept: true });

      expect(mockSeasonsService.validateParticipant).toHaveBeenCalledWith(1, 2, { accept: true });
      expect(mockSeasonsService.getParticipants).toHaveBeenCalledTimes(1);
      expect(component.participants()).toContainEqual(updated);
    });

    it('refuse une demande — son statut passe à REJECTED dans la liste', () => {
      const updated: SeasonParticipant = { ...mockParticipants[1], status: 'REJECTED' };
      mockSeasonsService.validateParticipant.mockReturnValue(of(updated));

      configure();
      fixture = TestBed.createComponent(SeasonDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.onValidate({ pid: 2, accept: false });

      expect(component.participants()).toContainEqual(updated);
      expect(component.pendingCount()).toBe(0);
    });
  });

  // ── onPromote() ──────────────────────────────────────────────────────────

  describe('onPromote()', () => {
    it('promeut un participant et met à jour la liste localement', () => {
      const updated: SeasonParticipant = { ...mockParticipants[2], isOrganizer: true };
      mockSeasonsService.promote.mockReturnValue(of(updated));

      configure();
      fixture = TestBed.createComponent(SeasonDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.onPromote(3);
      expect(component.pendingPromote()).toEqual(mockParticipants[2]);
      expect(mockSeasonsService.promote).not.toHaveBeenCalled();

      component.onConfirmPromote();

      expect(mockSeasonsService.promote).toHaveBeenCalledWith(1, 3);
      expect(component.participants()).toContainEqual(updated);
    });

    it('n\'appelle pas l\'API si la confirmation est refusée', () => {
      configure();
      fixture = TestBed.createComponent(SeasonDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.onPromote(3);
      component.pendingPromote.set(null);

      expect(mockSeasonsService.promote).not.toHaveBeenCalled();
    });
  });

  // ── onChangeState() ──────────────────────────────────────────────────────

  describe('onChangeState()', () => {
    it('change l\'état de la saison après confirmation', () => {
      const updated: Season = { ...mockSeason, state: 'EN_COURS' };
      mockSeasonsService.changeState.mockReturnValue(of(updated));

      configure();
      fixture = TestBed.createComponent(SeasonDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.onChangeState('EN_COURS');
      expect(component.pendingState()).toBe('EN_COURS');
      expect(mockSeasonsService.changeState).not.toHaveBeenCalled();

      component.onConfirmChangeState();

      expect(mockSeasonsService.changeState).toHaveBeenCalledWith(1, { state: 'EN_COURS' });
      expect(component.season()?.state).toBe('EN_COURS');
      expect(component.stateTransitioning()).toBe(false);
    });

    it('n\'appelle pas l\'API si la confirmation est refusée', () => {
      configure();
      fixture = TestBed.createComponent(SeasonDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.onChangeState('EN_COURS');
      component.pendingState.set(null);

      expect(mockSeasonsService.changeState).not.toHaveBeenCalled();
    });

    it('affiche une erreur si le changement d\'état échoue', () => {
      mockSeasonsService.changeState.mockReturnValue(throwError(() => new Error('500')));

      configure();
      fixture = TestBed.createComponent(SeasonDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.onChangeState('EN_COURS');
      component.onConfirmChangeState();

      expect(component.error()).not.toBe('');
      expect(component.stateTransitioning()).toBe(false);
    });
  });

  // ── onRemoveParticipant() ────────────────────────────────────────────────

  describe('onRemoveParticipant()', () => {
    it('retire le participant localement après confirmation', () => {
      mockSeasonsService.removeParticipant.mockReturnValue(of(undefined));

      configure();
      fixture = TestBed.createComponent(SeasonDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.onRemoveParticipant(2);
      expect(component.pendingRemoveParticipant()).toEqual(mockParticipants[1]);
      expect(mockSeasonsService.removeParticipant).not.toHaveBeenCalled();

      component.onConfirmRemoveParticipant();

      expect(mockSeasonsService.removeParticipant).toHaveBeenCalledWith(1, 2);
      expect(component.participants()).toEqual([mockParticipants[0], mockParticipants[2], mockParticipants[3]]);
    });

    it('n\'appelle pas l\'API si la confirmation est refusée', () => {
      configure();
      fixture = TestBed.createComponent(SeasonDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.onRemoveParticipant(2);
      component.pendingRemoveParticipant.set(null);

      expect(mockSeasonsService.removeParticipant).not.toHaveBeenCalled();
      expect(component.participants()).toEqual(mockParticipants);
    });

    it('affiche une erreur et recharge la liste si le retrait échoue', () => {
      mockSeasonsService.removeParticipant.mockReturnValue(throwError(() => new Error('400')));

      configure();
      fixture = TestBed.createComponent(SeasonDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.onRemoveParticipant(1);
      component.onConfirmRemoveParticipant();

      expect(component.error()).not.toBe('');
      expect(mockSeasonsService.getParticipants).toHaveBeenCalledTimes(2);
    });
  });

  // ── deleteSeason() ───────────────────────────────────────────────────────

  describe('deleteSeason()', () => {
    it('supprime la saison et navigue vers /seasons après confirmation', () => {
      mockSeasonsService.remove.mockReturnValue(of(undefined));

      configure();
      fixture = TestBed.createComponent(SeasonDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.deleteSeason();
      expect(component.showDeleteSeasonConfirm()).toBe(true);
      expect(mockSeasonsService.remove).not.toHaveBeenCalled();

      component.onConfirmDeleteSeason();

      expect(mockSeasonsService.remove).toHaveBeenCalledWith(1);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/seasons']);
    });

    it('n\'appelle pas l\'API si la confirmation est refusée', () => {
      configure();
      fixture = TestBed.createComponent(SeasonDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.deleteSeason();
      component.showDeleteSeasonConfirm.set(false);

      expect(mockSeasonsService.remove).not.toHaveBeenCalled();
    });

    it('affiche un message d\'erreur si la suppression échoue', () => {
      mockSeasonsService.remove.mockReturnValue(throwError(() => new Error('500')));

      configure();
      fixture = TestBed.createComponent(SeasonDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.deleteSeason();
      component.onConfirmDeleteSeason();

      expect(component.error()).not.toBe('');
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });

  // ── Affichage divers ─────────────────────────────────────────────────────

  describe('affichage', () => {
    it('affiche un libellé humain pour l\'état de la saison', () => {
      configure();
      fixture = TestBed.createComponent(SeasonDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.stateLabel()).toBe('En construction');
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('En construction');
    });

    it('affiche un lien de retour vers /seasons', () => {
      configure();
      fixture = TestBed.createComponent(SeasonDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      const link = el.querySelector('a.season-detail-back');
      expect(link).not.toBeNull();
      expect(link?.textContent).toContain('Mes saisons');
    });

    it('affiche la zone dangereuse pour l\'organisateur', () => {
      configure();
      fixture = TestBed.createComponent(SeasonDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.season-detail-danger-zone')).not.toBeNull();
      expect(el.querySelector('.season-detail-delete')).not.toBeNull();
    });

    it('masque la zone dangereuse pour un non-organisateur', () => {
      mockSeasonsService.getOne.mockReturnValue(of({ ...mockSeason, myRole: 'participant' }));

      configure();
      fixture = TestBed.createComponent(SeasonDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.season-detail-danger-zone')).toBeNull();
    });

    it('affiche la carte d\'état pour l\'organisateur', () => {
      configure();
      fixture = TestBed.createComponent(SeasonDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.season-state-card')).not.toBeNull();
    });

    it('masque la carte d\'état pour un non-organisateur', () => {
      mockSeasonsService.getOne.mockReturnValue(of({ ...mockSeason, myRole: 'participant' }));

      configure();
      fixture = TestBed.createComponent(SeasonDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.season-state-card')).toBeNull();
    });
  });
});
