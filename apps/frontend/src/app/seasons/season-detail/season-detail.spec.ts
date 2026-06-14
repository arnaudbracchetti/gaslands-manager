/**
 * Tests unitaires pour SeasonDetail.
 *
 * Composant "smart" : on mocke SeasonsService (cf. season-join.spec.ts pour
 * le pattern de mock + ActivatedRoute).
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { SeasonDetail } from './season-detail';
import { SeasonsService } from '../seasons.service';
import { Season } from '../season.model';
import { SeasonParticipant } from '../season-participant.model';

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

const mockParticipants: SeasonParticipant[] = [
  { id: 1, userId: 42, teamId: 7, status: 'VALIDATED', isOrganizer: true, userName: 'Jean Dupont', teamName: 'Furies' },
  { id: 2, userId: 43, teamId: 8, status: 'PENDING', isOrganizer: false, userName: 'Alice Martin', teamName: 'Scrap Kings' },
];

describe('SeasonDetail', () => {
  let component: SeasonDetail;
  let fixture: ComponentFixture<SeasonDetail>;
  let mockSeasonsService: {
    getOne: ReturnType<typeof vi.fn>;
    getParticipants: ReturnType<typeof vi.fn>;
    validateParticipant: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };

  function configure(seasonId = '1'): void {
    TestBed.configureTestingModule({
      imports: [SeasonDetail],
      providers: [
        { provide: SeasonsService, useValue: mockSeasonsService },
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
      remove: vi.fn(),
    };
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
  });

  it('répartit les participants entre validés et en attente', () => {
    configure();
    fixture = TestBed.createComponent(SeasonDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.validated()).toEqual([mockParticipants[0]]);
    expect(component.pending()).toEqual([mockParticipants[1]]);
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
    it('met à jour le participant localement sans recharger la liste (CA4/CA5)', () => {
      const updated: SeasonParticipant = { ...mockParticipants[1], status: 'VALIDATED' };
      mockSeasonsService.validateParticipant.mockReturnValue(of(updated));

      configure();
      fixture = TestBed.createComponent(SeasonDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.onValidate({ pid: 2, accept: true });

      expect(mockSeasonsService.validateParticipant).toHaveBeenCalledWith(1, 2, { accept: true });
      expect(mockSeasonsService.getParticipants).toHaveBeenCalledTimes(1);
      expect(component.validated()).toEqual([mockParticipants[0], updated]);
      expect(component.pending()).toEqual([]);
    });

    it('refuse une demande — elle disparaît de la liste "en attente"', () => {
      const updated: SeasonParticipant = { ...mockParticipants[1], status: 'REJECTED' };
      mockSeasonsService.validateParticipant.mockReturnValue(of(updated));

      configure();
      fixture = TestBed.createComponent(SeasonDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.onValidate({ pid: 2, accept: false });

      expect(component.pending()).toEqual([]);
      expect(component.validated()).toEqual([mockParticipants[0]]);
    });
  });

  // ── deleteSeason() ───────────────────────────────────────────────────────

  describe('deleteSeason()', () => {
    it('supprime la saison et navigue vers /seasons après confirmation', () => {
      vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
      mockSeasonsService.remove.mockReturnValue(of(undefined));

      configure();
      fixture = TestBed.createComponent(SeasonDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.deleteSeason();

      expect(mockSeasonsService.remove).toHaveBeenCalledWith(1);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/seasons']);
    });

    it('n\'appelle pas l\'API si la confirmation est refusée', () => {
      vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));

      configure();
      fixture = TestBed.createComponent(SeasonDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.deleteSeason();

      expect(mockSeasonsService.remove).not.toHaveBeenCalled();
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('affiche un message d\'erreur si la suppression échoue', () => {
      vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
      mockSeasonsService.remove.mockReturnValue(throwError(() => new Error('500')));

      configure();
      fixture = TestBed.createComponent(SeasonDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.deleteSeason();

      expect(component.error()).not.toBe('');
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });
});
