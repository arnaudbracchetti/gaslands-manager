/**
 * Tests unitaires pour CampaignDetail.
 *
 * Composant "smart" : on mocke CampaignsService.
 * Le composant utilise désormais une liste de participants unifiée (tous statuts)
 * et une carte d'état pour les transitions de saison.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { CampaignDetail } from './campaign-detail';
import { CampaignsService } from '../campaigns.service';
import { Campaign } from '../campaign.model';
import { CampaignParticipant, StandingsEntry } from '../campaign-participant.model';
import { ParticipantJournalEntryDto } from '../game.model';
import { AuthService } from '../../auth/auth.service';
import { User } from '../../auth/auth.model';
import { TeamsService } from '../../teams/teams.service';

const mockCampaign: Campaign = {
  id: 1,
  name: 'Coupe Verney',
  state: 'EN_CONSTRUCTION',
  inviteCode: 'abcdef123456',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  participantCount: 2,
  budget: 50,
  myRole: 'organizer',
};

const mockCurrentUser: User = {
  id: 42,
  firstName: 'Jean',
  lastName: 'Dupont',
  pseudo: 'JeanLeFou',
  callName: 'JeanLeFou',
  email: 'jean@example.com',
  role: 'user',
  isActive: true,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const mockParticipants: CampaignParticipant[] = [
  { id: 1, userId: 42, teamId: 7, status: 'VALIDATED', isOrganizer: true, userName: 'Jean Dupont', teamName: 'Furies' },
  { id: 2, userId: 43, teamId: 8, status: 'PENDING', isOrganizer: false, userName: 'Alice Martin', teamName: 'Scrap Kings' },
  { id: 3, userId: 44, teamId: 10, status: 'VALIDATED', isOrganizer: false, userName: 'Bob Martin', teamName: 'Bandits' },
  { id: 4, userId: 45, teamId: 11, status: 'REJECTED', isOrganizer: false, userName: 'Dan Fury', teamName: 'Outlaws' },
];

describe('CampaignDetail', () => {
  let component: CampaignDetail;
  let fixture: ComponentFixture<CampaignDetail>;
  let mockCampaignsService: {
    getOne: ReturnType<typeof vi.fn>;
    getParticipants: ReturnType<typeof vi.fn>;
    getStandings: ReturnType<typeof vi.fn>;
    validateParticipant: ReturnType<typeof vi.fn>;
    removeParticipant: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    changeState: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    promote: ReturnType<typeof vi.fn>;
    getParticipantJournal: ReturnType<typeof vi.fn>;
    getTeamSheet: ReturnType<typeof vi.fn>;
    getParticipantTeamSheet: ReturnType<typeof vi.fn>;
    // Appelés par le composant enfant CampaignProgram (désormais toujours monté).
    getGames: ReturnType<typeof vi.fn>;
    getScenarios: ReturnType<typeof vi.fn>;
  };
  let mockAuthService: { currentUser: ReturnType<typeof signal<User | null>> };
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };
  let mockTeamsService: { getAll: ReturnType<typeof vi.fn> };

  function configure(campaignId = '1'): void {
    TestBed.configureTestingModule({
      imports: [CampaignDetail],
      providers: [
        provideRouter([]),
        { provide: CampaignsService, useValue: mockCampaignsService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
        { provide: TeamsService, useValue: mockTeamsService },
        { provide: ActivatedRoute, useValue: { snapshot: { params: { id: campaignId } } } },
      ],
    });
  }

  beforeEach(() => {
    mockCampaignsService = {
      getOne: vi.fn().mockReturnValue(of(mockCampaign)),
      getParticipants: vi.fn().mockReturnValue(of(mockParticipants)),
      getStandings: vi.fn().mockReturnValue(of([])),
      validateParticipant: vi.fn(),
      removeParticipant: vi.fn(),
      remove: vi.fn(),
      changeState: vi.fn(),
      update: vi.fn(),
      promote: vi.fn(),
      getParticipantJournal: vi.fn().mockReturnValue(of([])),
      getTeamSheet: vi.fn().mockReturnValue(of('<!doctype html><html></html>')),
      getParticipantTeamSheet: vi.fn().mockReturnValue(of('<!doctype html><html></html>')),
      getGames: vi.fn().mockReturnValue(of([])),
      getScenarios: vi.fn().mockReturnValue(of([])),
    };
    mockAuthService = { currentUser: signal<User | null>(mockCurrentUser) };
    mockRouter = { navigate: vi.fn() };
    mockTeamsService = { getAll: vi.fn().mockReturnValue(of([])) };
  });

  afterEach(() => vi.clearAllMocks());

  // ── Chargement initial ───────────────────────────────────────────────────

  it('charge la saison et ses participants au démarrage', () => {
    configure();
    fixture = TestBed.createComponent(CampaignDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(mockCampaignsService.getOne).toHaveBeenCalledWith(1);
    expect(mockCampaignsService.getParticipants).toHaveBeenCalledWith(1);
    expect(component.campaign()).toEqual(mockCampaign);
    expect(component.loading()).toBe(false);
    expect(component.participants()).toEqual(mockParticipants);
  });

  it('myParticipant correspond au participant de l\'utilisateur connecté', () => {
    configure();
    fixture = TestBed.createComponent(CampaignDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.myParticipant()).toEqual(mockParticipants[0]);
  });

  it('validatedCount et pendingCount reflètent les statuts des participants', () => {
    configure();
    fixture = TestBed.createComponent(CampaignDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.validatedCount()).toBe(2); // Jean + Bob
    expect(component.pendingCount()).toBe(1);   // Alice
  });

  it('affiche un message d\'erreur générique si la saison est introuvable (CA3)', () => {
    mockCampaignsService.getOne.mockReturnValue(throwError(() => new Error('404')));

    configure();
    fixture = TestBed.createComponent(CampaignDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.error()).not.toBe('');
    expect(component.campaign()).toBeNull();
    expect(component.loading()).toBe(false);
  });

  // ── Classement (Points de Championnat) ───────────────────────────────────

  describe('championshipPoints', () => {
    it('charge les standings au démarrage et construit la map par participantId', () => {
      const standings: StandingsEntry[] = [
        { participantId: 1, userId: 42, teamId: 7, teamName: 'Furies', championshipPoints: 10, wallet: 5 },
        { participantId: 3, userId: 44, teamId: 10, teamName: 'Bandits', championshipPoints: 5, wallet: 2 },
      ];
      mockCampaignsService.getStandings.mockReturnValue(of(standings));

      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(mockCampaignsService.getStandings).toHaveBeenCalledWith(1);
      expect(component.championshipPoints().get(1)).toBe(10);
      expect(component.championshipPoints().get(3)).toBe(5);
      // Alice (id 2, PENDING) n'apparaît pas dans les standings → absente de la map.
      expect(component.championshipPoints().has(2)).toBe(false);
    });

    it('la map de PC reste vide si aucune partie n\'a été jouée', () => {
      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.championshipPoints().size).toBe(0);
    });

    it('n\'empêche pas l\'affichage des participants si /standings échoue', () => {
      mockCampaignsService.getStandings.mockReturnValue(throwError(() => new Error('500')));

      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.participants()).toEqual(mockParticipants);
      expect(component.error()).toBe('');
    });

    it('onResultRecorded() recharge les standings (déclenché par CampaignProgram)', () => {
      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(mockCampaignsService.getStandings).toHaveBeenCalledTimes(1);

      const updated: StandingsEntry[] = [
        { participantId: 1, userId: 42, teamId: 7, teamName: 'Furies', championshipPoints: 10, wallet: 5 },
      ];
      mockCampaignsService.getStandings.mockReturnValue(of(updated));

      component.onResultRecorded();

      expect(mockCampaignsService.getStandings).toHaveBeenCalledTimes(2);
      expect(component.championshipPoints().get(1)).toBe(10);
    });
  });

  // ── isOrganizer ──────────────────────────────────────────────────────────

  it('isOrganizer est vrai quand myRole === "organizer"', () => {
    configure();
    fixture = TestBed.createComponent(CampaignDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.isOrganizer()).toBe(true);
  });

  it('isOrganizer est faux quand myRole === "participant"', () => {
    mockCampaignsService.getOne.mockReturnValue(of({ ...mockCampaign, myRole: 'participant' }));

    configure();
    fixture = TestBed.createComponent(CampaignDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.isOrganizer()).toBe(false);
  });

  // ── onValidate ───────────────────────────────────────────────────────────

  describe('onValidate()', () => {
    it('met à jour le participant localement sans recharger la liste', () => {
      const updated: CampaignParticipant = { ...mockParticipants[1], status: 'VALIDATED' };
      mockCampaignsService.validateParticipant.mockReturnValue(of(updated));

      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.onValidate({ pid: 2, accept: true });

      expect(mockCampaignsService.validateParticipant).toHaveBeenCalledWith(1, 2, { accept: true });
      // CampaignDetail + CampaignProgram (enfant) appellent tous deux getParticipants au démarrage.
      expect(mockCampaignsService.getParticipants).toHaveBeenCalledTimes(2);
      expect(component.participants()).toContainEqual(updated);
    });

    it('refuse une demande — son statut passe à REJECTED dans la liste', () => {
      const updated: CampaignParticipant = { ...mockParticipants[1], status: 'REJECTED' };
      mockCampaignsService.validateParticipant.mockReturnValue(of(updated));

      configure();
      fixture = TestBed.createComponent(CampaignDetail);
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
      const updated: CampaignParticipant = { ...mockParticipants[2], isOrganizer: true };
      mockCampaignsService.promote.mockReturnValue(of(updated));

      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.onPromote(3);
      expect(component.pendingPromote()).toEqual(mockParticipants[2]);
      expect(mockCampaignsService.promote).not.toHaveBeenCalled();

      component.onConfirmPromote();

      expect(mockCampaignsService.promote).toHaveBeenCalledWith(1, 3);
      expect(component.participants()).toContainEqual(updated);
    });

    it('n\'appelle pas l\'API si la confirmation est refusée', () => {
      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.onPromote(3);
      component.pendingPromote.set(null);

      expect(mockCampaignsService.promote).not.toHaveBeenCalled();
    });
  });

  // ── onViewJournal() / onParticipantJournalClosed() ──────────────────────

  describe('onViewJournal()', () => {
    it('ouvre la modale et charge l\'historique du participant ciblé', () => {
      const entries: ParticipantJournalEntryDto[] = [
        { eventId: 100, gameId: 7, gameOrder: 1, scenarioName: 'La Porte', description: 'Classé 1 (+10 PC)', createdAt: '2026-07-01T00:00:00.000Z' },
      ];
      mockCampaignsService.getParticipantJournal.mockReturnValue(of(entries));

      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.onViewJournal(3);

      expect(mockCampaignsService.getParticipantJournal).toHaveBeenCalledWith(1, 3);
      expect(component.journalParticipant()).toEqual(mockParticipants[2]);
      expect(component.participantJournalEntries()).toEqual(entries);
      expect(component.loadingParticipantJournal()).toBe(false);
    });

    it('affiche une erreur si le chargement échoue', () => {
      mockCampaignsService.getParticipantJournal.mockReturnValue(throwError(() => new Error('500')));

      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.onViewJournal(3);

      expect(component.error()).not.toBe('');
      expect(component.loadingParticipantJournal()).toBe(false);
    });
  });

  describe('onParticipantJournalClosed()', () => {
    it('réinitialise les signaux de la modale', () => {
      mockCampaignsService.getParticipantJournal.mockReturnValue(
        of([{ eventId: 100, gameId: 7, gameOrder: 1, scenarioName: 'La Porte', description: 'x', createdAt: '2026-07-01T00:00:00.000Z' }]),
      );

      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.onViewJournal(3);
      expect(component.journalParticipant()).not.toBeNull();

      component.onParticipantJournalClosed();

      expect(component.journalParticipant()).toBeNull();
      expect(component.participantJournalEntries()).toEqual([]);
      expect(component.loadingParticipantJournal()).toBe(false);
    });
  });

  // ── onExportSheet() ──────────────────────────────────────────────────────

  describe('onExportSheet()', () => {
    it('appelle getTeamSheet (pas getParticipantTeamSheet) quand pid est le sien', () => {
      const fakeWin = { document: { open: vi.fn(), write: vi.fn(), close: vi.fn() } } as unknown as Window;
      const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakeWin);

      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.onExportSheet(1); // mockParticipants[0], userId 42 = mockCurrentUser.id

      expect(openSpy).toHaveBeenCalledWith('', '_blank');
      expect(mockCampaignsService.getTeamSheet).toHaveBeenCalledWith(1);
      expect(mockCampaignsService.getParticipantTeamSheet).not.toHaveBeenCalled();
      expect(fakeWin.document.write).toHaveBeenCalledWith('<!doctype html><html></html>');

      openSpy.mockRestore();
    });

    it('appelle getParticipantTeamSheet (pas getTeamSheet) pour un autre participant', () => {
      const fakeWin = { document: { open: vi.fn(), write: vi.fn(), close: vi.fn() } } as unknown as Window;
      const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakeWin);

      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.onExportSheet(3); // mockParticipants[2], userId 44 ≠ mockCurrentUser.id

      expect(openSpy).toHaveBeenCalledWith('', '_blank');
      expect(mockCampaignsService.getParticipantTeamSheet).toHaveBeenCalledWith(1, 3);
      expect(mockCampaignsService.getTeamSheet).not.toHaveBeenCalled();
      expect(fakeWin.document.write).toHaveBeenCalledWith('<!doctype html><html></html>');

      openSpy.mockRestore();
    });

    it('ferme la fenêtre et affiche une erreur si l\'appel échoue', () => {
      const fakeWin = { document: { open: vi.fn(), write: vi.fn(), close: vi.fn() }, close: vi.fn() } as unknown as Window;
      vi.spyOn(window, 'open').mockReturnValue(fakeWin);
      mockCampaignsService.getTeamSheet.mockReturnValue(throwError(() => new Error('boom')));

      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.onExportSheet(1);

      expect(fakeWin.close).toHaveBeenCalled();
      expect(component.error()).not.toBe('');

      vi.mocked(window.open).mockRestore();
    });
  });

  // ── onChangeState() ──────────────────────────────────────────────────────

  describe('onChangeState()', () => {
    it('change l\'état de la saison après confirmation', () => {
      const updated: Campaign = { ...mockCampaign, state: 'EN_COURS' };
      mockCampaignsService.changeState.mockReturnValue(of(updated));

      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.onChangeState('EN_COURS');
      expect(component.pendingState()).toBe('EN_COURS');
      expect(mockCampaignsService.changeState).not.toHaveBeenCalled();

      component.onConfirmChangeState();

      expect(mockCampaignsService.changeState).toHaveBeenCalledWith(1, { state: 'EN_COURS' });
      expect(component.campaign()?.state).toBe('EN_COURS');
      expect(component.stateTransitioning()).toBe(false);
    });

    it('n\'appelle pas l\'API si la confirmation est refusée', () => {
      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.onChangeState('EN_COURS');
      component.pendingState.set(null);

      expect(mockCampaignsService.changeState).not.toHaveBeenCalled();
    });

    it('affiche une erreur si le changement d\'état échoue', () => {
      mockCampaignsService.changeState.mockReturnValue(throwError(() => new Error('500')));

      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.onChangeState('EN_COURS');
      component.onConfirmChangeState();

      expect(component.error()).not.toBe('');
      expect(component.stateTransitioning()).toBe(false);
    });
  });

  // ── canEditCampaign / modification nom-budget ───────────────────────────

  describe('canEditCampaign', () => {
    it('vrai pour l\'organisateur tant que la saison est EN_CONSTRUCTION', () => {
      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.canEditCampaign()).toBe(true);
    });

    it('faux pour un non-organisateur', () => {
      mockCampaignsService.getOne.mockReturnValue(of({ ...mockCampaign, myRole: 'participant' }));

      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.canEditCampaign()).toBe(false);
    });

    it('faux hors EN_CONSTRUCTION, même pour l\'organisateur', () => {
      mockCampaignsService.getOne.mockReturnValue(of({ ...mockCampaign, state: 'EN_COURS' }));

      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.canEditCampaign()).toBe(false);
    });
  });

  describe('onConfirmEditCampaign()', () => {
    it('met à jour la campagne et ferme la modale en cas de succès', () => {
      const updated: Campaign = { ...mockCampaign, name: 'Coupe Rutherford', budget: 30 };
      mockCampaignsService.update.mockReturnValue(of(updated));

      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.openEditCampaignModal();
      expect(component.showEditCampaignModal()).toBe(true);

      component.onConfirmEditCampaign({ name: 'Coupe Rutherford', budget: 30 });

      expect(mockCampaignsService.update).toHaveBeenCalledWith(1, { name: 'Coupe Rutherford', budget: 30 });
      expect(component.campaign()).toEqual(updated);
      expect(component.showEditCampaignModal()).toBe(false);
      expect(component.savingCampaign()).toBe(false);
    });

    it('garde la modale ouverte et affiche l\'erreur serveur en cas d\'échec (budget trop bas)', () => {
      mockCampaignsService.update.mockReturnValue(
        throwError(() => ({ error: { message: 'L\'équipe « Escouade » coûte 40 jerricans, au-delà du budget de la campagne (30).' } })),
      );

      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.openEditCampaignModal();
      component.onConfirmEditCampaign({ name: 'Coupe Verney', budget: 30 });

      expect(component.showEditCampaignModal()).toBe(true); // reste ouverte
      expect(component.editCampaignError()).toContain('Escouade');
      expect(component.savingCampaign()).toBe(false);
      expect(component.campaign()).toEqual(mockCampaign); // inchangé
    });

    it('affiche un message générique si le serveur ne fournit aucun message', () => {
      mockCampaignsService.update.mockReturnValue(throwError(() => ({ error: {} })));

      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.onConfirmEditCampaign({ name: 'Coupe Verney', budget: 30 });

      expect(component.editCampaignError()).toBe('Erreur lors de la modification de la saison.');
    });
  });

  describe('openEditCampaignModal() / onCancelEditCampaign()', () => {
    it('ouvre la modale sans appeler l\'API', () => {
      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.openEditCampaignModal();

      expect(component.showEditCampaignModal()).toBe(true);
      expect(mockCampaignsService.update).not.toHaveBeenCalled();
    });

    it('ferme la modale et efface l\'erreur au clic sur Annuler', () => {
      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.openEditCampaignModal();
      component.editCampaignError.set('une erreur précédente');

      component.onCancelEditCampaign();

      expect(component.showEditCampaignModal()).toBe(false);
      expect(component.editCampaignError()).toBe('');
    });
  });

  // ── onRemoveParticipant() ────────────────────────────────────────────────

  describe('onRemoveParticipant()', () => {
    it('retire le participant localement après confirmation', () => {
      mockCampaignsService.removeParticipant.mockReturnValue(of(undefined));

      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.onRemoveParticipant(2);
      expect(component.pendingRemoveParticipant()).toEqual(mockParticipants[1]);
      expect(mockCampaignsService.removeParticipant).not.toHaveBeenCalled();

      component.onConfirmRemoveParticipant();

      expect(mockCampaignsService.removeParticipant).toHaveBeenCalledWith(1, 2);
      expect(component.participants()).toEqual([mockParticipants[0], mockParticipants[2], mockParticipants[3]]);
    });

    it('n\'appelle pas l\'API si la confirmation est refusée', () => {
      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.onRemoveParticipant(2);
      component.pendingRemoveParticipant.set(null);

      expect(mockCampaignsService.removeParticipant).not.toHaveBeenCalled();
      expect(component.participants()).toEqual(mockParticipants);
    });

    it('affiche une erreur et recharge la liste si le retrait échoue', () => {
      mockCampaignsService.removeParticipant.mockReturnValue(throwError(() => new Error('400')));

      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.onRemoveParticipant(1);
      component.onConfirmRemoveParticipant();

      expect(component.error()).not.toBe('');
      // CampaignDetail (init + reload après erreur) + CampaignProgram (init) = 3 appels.
      expect(mockCampaignsService.getParticipants).toHaveBeenCalledTimes(3);
    });
  });

  // ── deleteCampaign() ───────────────────────────────────────────────────────

  describe('deleteCampaign()', () => {
    it('supprime la saison et navigue vers /campaigns après confirmation', () => {
      mockCampaignsService.remove.mockReturnValue(of(undefined));

      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.deleteCampaign();
      expect(component.showDeleteCampaignConfirm()).toBe(true);
      expect(mockCampaignsService.remove).not.toHaveBeenCalled();

      component.onConfirmDeleteCampaign();

      expect(mockCampaignsService.remove).toHaveBeenCalledWith(1);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/campaigns']);
    });

    it('n\'appelle pas l\'API si la confirmation est refusée', () => {
      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.deleteCampaign();
      component.showDeleteCampaignConfirm.set(false);

      expect(mockCampaignsService.remove).not.toHaveBeenCalled();
    });

    it('affiche un message d\'erreur si la suppression échoue', () => {
      mockCampaignsService.remove.mockReturnValue(throwError(() => new Error('500')));

      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.deleteCampaign();
      component.onConfirmDeleteCampaign();

      expect(component.error()).not.toBe('');
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });

  // ── Affichage divers ─────────────────────────────────────────────────────

  describe('affichage', () => {
    it('affiche un libellé humain pour l\'état de la saison', () => {
      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.stateLabel()).toBe('En construction');
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('En construction');
    });

    it('affiche un fil d\'ariane avec un lien vers /campaigns', () => {
      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      const breadcrumb = el.querySelector('app-breadcrumb');
      expect(breadcrumb).not.toBeNull();
    });

    it('affiche la zone dangereuse pour l\'organisateur', () => {
      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.campaign-detail-danger-zone')).not.toBeNull();
      expect(el.querySelector('.campaign-detail-delete')).not.toBeNull();
    });

    it('masque la zone dangereuse pour un non-organisateur', () => {
      mockCampaignsService.getOne.mockReturnValue(of({ ...mockCampaign, myRole: 'participant' }));

      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.campaign-detail-danger-zone')).toBeNull();
    });

    it('affiche le bouton Modifier pour l\'organisateur en EN_CONSTRUCTION', () => {
      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.campaign-detail-edit-btn')).not.toBeNull();
    });

    it('masque le bouton Modifier hors EN_CONSTRUCTION', () => {
      mockCampaignsService.getOne.mockReturnValue(of({ ...mockCampaign, state: 'EN_COURS' }));

      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.campaign-detail-edit-btn')).toBeNull();
    });

    it('affiche la carte d\'état pour l\'organisateur', () => {
      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.campaign-state-card')).not.toBeNull();
    });

    it('masque la carte d\'état pour un non-organisateur', () => {
      mockCampaignsService.getOne.mockReturnValue(of({ ...mockCampaign, myRole: 'participant' }));

      configure();
      fixture = TestBed.createComponent(CampaignDetail);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.campaign-state-card')).toBeNull();
    });
  });
});
