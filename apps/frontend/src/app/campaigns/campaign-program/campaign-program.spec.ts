/**
 * Tests unitaires pour CampaignProgram (composant smart).
 *
 * On teste l'orchestration : chargement des parties + scénarios, ouverture du
 * formulaire (création/édition), création/mise à jour, suppression confirmée,
 * et la règle canManage (= organisateur, le parent ne montant le composant
 * que lorsque la saison est EN_COURS).
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { of, throwError } from 'rxjs';
import { CampaignProgram } from './campaign-program';
import { CampaignsService } from '../campaigns.service';
import { Game, Scenario } from '../game.model';

const mockScenarios: Scenario[] = [
  {
    nom: 'La Course de la Mort', nom_interne: 'course_de_la_mort', type: 'EVENEMENT_TELE', description: '',
    franchissement_portes: true, gain_jerricans: false,
  },
];

const mockGame: Game = {
  id: 10,
  campaignId: 1,
  scenarioId: 'course_de_la_mort',
  scenarioName: 'La Course de la Mort',
  type: 'EVENEMENT_TELE',
  status: 'PLANIFIE',
  order: 1,
  playedAt: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  franchissementPortes: true,
  gainJerricans: false,
};

describe('CampaignProgram Component', () => {
  let component: CampaignProgram;
  let fixture: ComponentFixture<CampaignProgram>;
  let mockService: {
    getGames: ReturnType<typeof vi.fn>;
    getScenarios: ReturnType<typeof vi.fn>;
    createGame: ReturnType<typeof vi.fn>;
    updateGame: ReturnType<typeof vi.fn>;
    deleteGame: ReturnType<typeof vi.fn>;
    reorderGames: ReturnType<typeof vi.fn>;
    getParticipants: ReturnType<typeof vi.fn>;
    recordResult: ReturnType<typeof vi.fn>;
    resetResult: ReturnType<typeof vi.fn>;
    rollIncome: ReturnType<typeof vi.fn>;
    getParticipantVehicles: ReturnType<typeof vi.fn>;
    resolveWreck: ReturnType<typeof vi.fn>;
    enterAtelier: ReturnType<typeof vi.fn>;
    getGameJournal: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockService = {
      getGames: vi.fn().mockReturnValue(of([mockGame])),
      getScenarios: vi.fn().mockReturnValue(of(mockScenarios)),
      createGame: vi.fn().mockReturnValue(of(mockGame)),
      updateGame: vi.fn().mockReturnValue(of(mockGame)),
      deleteGame: vi.fn().mockReturnValue(of(undefined)),
      reorderGames: vi.fn().mockReturnValue(of(undefined)),
      getParticipants: vi.fn().mockReturnValue(of([])),
      recordResult: vi.fn().mockReturnValue(of({ ...mockGame, status: 'PLANIFIE' })),
      resetResult: vi.fn().mockReturnValue(of(undefined)),
      rollIncome: vi.fn().mockReturnValue(of({ amount: 4, descriptions: ['+4 jerricans (Récompense)'] })),
      getParticipantVehicles: vi.fn().mockReturnValue(of([
        { participantId: 1, vehicles: [{ vehicleId: 100, nom: 'Voiture', weightClass: 'MOYEN', hasFavoriDuPublic: false }] },
      ])),
      resolveWreck: vi.fn().mockReturnValue(of({
        outcome: { vehicleId: 100, diceRoll: 3, chocsBefore: 0, wreckResult: 'INDEMNE', chocsGained: 0, lostEquipment: null },
        descriptions: ['Table des Épaves : S\'en sort indemne (D6=3+0 chocs)'],
      })),
      enterAtelier: vi.fn().mockReturnValue(of({ autoClosedGameId: null })),
      getGameJournal: vi.fn().mockReturnValue(of([
        { participantId: 1, userName: 'Ada Lovelace', teamName: 'Les Furieux', description: 'Classé 1 (+10 PC)', createdAt: '2026-07-01T00:00:00.000Z' },
      ])),
    };

    await TestBed.configureTestingModule({
      imports: [CampaignProgram],
      providers: [{ provide: CampaignsService, useValue: mockService }],
    }).compileComponents();

    fixture = TestBed.createComponent(CampaignProgram);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('campaignId', 1);
    fixture.componentRef.setInput('isOrganizer', true);
    fixture.componentRef.setInput('campaignState', 'EN_CONSTRUCTION');
  });

  it('charge les parties et les scénarios à l\'initialisation', () => {
    fixture.detectChanges();

    expect(mockService.getGames).toHaveBeenCalledWith(1);
    expect(mockService.getScenarios).toHaveBeenCalled();
    expect(component.games()).toEqual([mockGame]);
    expect(component.scenarios()).toEqual(mockScenarios);
  });

  it('canManage suit le rôle organisateur', () => {
    fixture.detectChanges();
    expect(component.canManage()).toBe(true);

    fixture.componentRef.setInput('isOrganizer', false);
    expect(component.canManage()).toBe(false);
  });

  it('canManage est faux en TERMINEE même pour l\'organisateur (lecture seule)', () => {
    fixture.detectChanges();
    expect(component.canManage()).toBe(true);

    fixture.componentRef.setInput('campaignState', 'TERMINEE');
    expect(component.canManage()).toBe(false);
  });

  it('canManage reste vrai en EN_COURS pour l\'organisateur', () => {
    fixture.componentRef.setInput('campaignState', 'EN_COURS');
    fixture.detectChanges();
    expect(component.canManage()).toBe(true);
  });

  it('ouvre le formulaire en mode création', () => {
    fixture.detectChanges();

    component.openCreate();

    expect(component.showForm()).toBe(true);
    expect(component.editingGame()).toBeNull();
  });

  it('ouvre le formulaire pré-rempli en mode édition', () => {
    fixture.detectChanges();

    component.onEdit(mockGame);

    expect(component.showForm()).toBe(true);
    expect(component.editingGame()).toEqual(mockGame);
  });

  it('crée une partie puis recharge la liste', () => {
    fixture.detectChanges();
    mockService.getGames.mockClear();

    component.openCreate();
    component.onSaved({ scenarioId: 'course_de_la_mort' });

    expect(mockService.createGame).toHaveBeenCalledWith(1, { scenarioId: 'course_de_la_mort' });
    expect(mockService.getGames).toHaveBeenCalledWith(1);
    expect(component.showForm()).toBe(false);
  });

  it('met à jour une partie en mode édition', () => {
    fixture.detectChanges();

    component.onEdit(mockGame);
    component.onSaved({ scenarioId: 'course_de_la_mort' });

    expect(mockService.updateGame).toHaveBeenCalledWith(1, 10, { scenarioId: 'course_de_la_mort' });
    expect(mockService.createGame).not.toHaveBeenCalled();
  });

  it('supprime une partie après confirmation', () => {
    fixture.detectChanges();
    mockService.getGames.mockClear();

    component.onDelete(mockGame);
    expect(component.pendingDeleteGame()).toEqual(mockGame);

    component.onConfirmDelete();

    expect(mockService.deleteGame).toHaveBeenCalledWith(1, 10);
    expect(mockService.getGames).toHaveBeenCalledWith(1);
    expect(component.pendingDeleteGame()).toBeNull();
  });

  it('réordonne le programme puis recharge (US-A4)', () => {
    fixture.detectChanges();
    mockService.getGames.mockClear();

    component.onReorder([30, 10]);

    expect(mockService.reorderGames).toHaveBeenCalledWith(1, [30, 10]);
    expect(mockService.getGames).toHaveBeenCalledWith(1);
  });

  it('recharge quand même le programme si le réordonnancement échoue (resync serveur)', () => {
    mockService.reorderGames.mockReturnValue(throwError(() => new Error('boom')));
    fixture.detectChanges();
    mockService.getGames.mockClear();

    component.onReorder([30, 10]);

    expect(component.error()).not.toBe('');
    expect(mockService.getGames).toHaveBeenCalledWith(1);
  });

  it('affiche une erreur si le chargement échoue', () => {
    mockService.getGames.mockReturnValue(throwError(() => new Error('boom')));

    fixture.detectChanges();

    expect(component.error()).not.toBe('');
    expect(component.loading()).toBe(false);
  });

  it('affiche GameResultWizard en popup, sans masquer GameList', () => {
    fixture.detectChanges();
    component.recordingGame.set(mockGame);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-game-result-wizard')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-game-list')).toBeTruthy();
  });

  it('onRecordGame met à jour recordingGame', () => {
    const game: Game = { ...mockGame, id: 2, status: 'PLANIFIE' };
    component.onRecordGame(game);
    expect(component.recordingGame()).toEqual(game);
  });

  it('onWizardCancelled remet recordingGame à null sans appel réseau si rien n\'a été persisté', () => {
    component.recordingGame.set({ ...mockGame, id: 1 });
    component.onWizardCancelled();
    expect(component.recordingGame()).toBeNull();
    expect(mockService.resetResult).not.toHaveBeenCalled();
  });

  it('onWizardCancelled appelle resetResult si un lot a déjà été persisté (wizardResultRecorded non-null)', () => {
    fixture.detectChanges();
    component.recordingGame.set(mockGame);
    component.onBatchReady({ results: [] }); // alimente wizardResultRecorded

    component.onWizardCancelled();

    expect(mockService.resetResult).toHaveBeenCalledWith(1, 10);
    expect(component.recordingGame()).toBeNull();
    expect(component.resettingResult()).toBe(false);
  });

  it('onWizardCancelled affiche une erreur et laisse le wizard ouvert si resetResult échoue', () => {
    mockService.resetResult.mockReturnValue(throwError(() => new Error('boom')));
    fixture.detectChanges();
    component.recordingGame.set(mockGame);
    component.onBatchReady({ results: [] });

    component.onWizardCancelled();

    expect(component.error()).not.toBe('');
    expect(component.recordingGame()).toBe(mockGame);
    expect(component.resettingResult()).toBe(false);
  });

  it('onPresentParticipantsChanged charge les véhicules des participants indiqués', () => {
    component.recordingGame.set(mockGame);
    component.onPresentParticipantsChanged([1]);

    expect(mockService.getParticipantVehicles).toHaveBeenCalledWith(1, 10, [1]);
    expect(component.participantVehicles().get(1)).toEqual([
      { vehicleId: 100, nom: 'Voiture', weightClass: 'MOYEN', hasFavoriDuPublic: false },
    ]);
  });

  it('onPresentParticipantsChanged vide la map si aucun participant présent', () => {
    component.recordingGame.set(mockGame);
    component.onPresentParticipantsChanged([1]);
    component.onPresentParticipantsChanged([]);

    expect(component.participantVehicles().size).toBe(0);
  });

  it('onBatchReady enregistre le lot et alimente wizardResultRecorded (sans émettre resultRecorded)', () => {
    fixture.detectChanges();
    component.recordingGame.set(mockGame);

    let emittedCount = 0;
    outputToObservable(component.resultRecorded).subscribe(() => { emittedCount++; });

    component.onBatchReady({ results: [] });

    expect(mockService.recordResult).toHaveBeenCalledWith(1, 10, { results: [] });
    expect(component.wizardResultRecorded()).toEqual({ ...mockGame, status: 'PLANIFIE' });
    expect(emittedCount).toBe(0);
  });

  it('n\'alimente pas wizardResultRecorded si l\'enregistrement du résultat échoue', () => {
    mockService.recordResult.mockReturnValue(throwError(() => new Error('boom')));
    fixture.detectChanges();
    component.recordingGame.set(mockGame);

    component.onBatchReady({ results: [] });

    expect(component.wizardResultRecorded()).toBeNull();
  });

  it('onIncomeRollRequested appelle rollIncome et alimente incomeResults', () => {
    fixture.detectChanges();
    component.recordingGame.set(mockGame);

    component.onIncomeRollRequested(1);

    expect(mockService.rollIncome).toHaveBeenCalledWith(1, 10, { participantId: 1 });
    expect(component.incomeResults().get(1)).toMatchObject({ amount: 4 });
  });

  it('onIncomeRollRequested affiche une erreur en cas d\'échec', () => {
    mockService.rollIncome.mockReturnValue(throwError(() => new Error('boom')));
    fixture.detectChanges();
    component.recordingGame.set(mockGame);

    component.onIncomeRollRequested(1);

    expect(component.error()).not.toBe('');
    expect(component.resolving()).toBe(false);
  });

  it('onWreckRollRequested appelle resolveWreck et alimente wreckOutcomes/wreckDescriptions', () => {
    fixture.detectChanges();
    component.recordingGame.set(mockGame);

    component.onWreckRollRequested({ participantId: 1, vehicleId: 100, pendingFavoriDuPublic: false });

    expect(mockService.resolveWreck).toHaveBeenCalledWith(1, 10, { participantId: 1, vehicleId: 100, pendingFavoriDuPublic: false });
    expect(component.wreckOutcomes().get(100)).toMatchObject({ wreckResult: 'INDEMNE' });
    expect(component.wreckDescriptions().get(100)).toEqual(['Table des Épaves : S\'en sort indemne (D6=3+0 chocs)']);
  });

  it('onWreckRollRequested affiche une erreur visible en cas d\'échec (au lieu de l\'avaler en silence)', () => {
    mockService.resolveWreck.mockReturnValue(throwError(() => new Error('boom')));
    fixture.detectChanges();
    component.recordingGame.set(mockGame);

    component.onWreckRollRequested({ participantId: 1, vehicleId: 100, pendingFavoriDuPublic: false });

    expect(component.error()).not.toBe('');
    expect(component.resolving()).toBe(false);
  });

  it('onWizardCompleted fait entrer la partie en atelier puis émet resultRecorded et ferme le wizard', () => {
    fixture.detectChanges();
    component.recordingGame.set(mockGame);

    let emittedCount = 0;
    outputToObservable(component.resultRecorded).subscribe(() => { emittedCount++; });

    component.onWizardCompleted();

    expect(mockService.enterAtelier).toHaveBeenCalledWith(1, 10);
    expect(component.recordingGame()).toBeNull();
    expect(emittedCount).toBe(1);
  });

  it('onWizardCompleted affiche une erreur et laisse le wizard ouvert si enterAtelier échoue', () => {
    mockService.enterAtelier.mockReturnValue(throwError(() => new Error('boom')));
    fixture.detectChanges();
    component.recordingGame.set(mockGame);

    component.onWizardCompleted();

    expect(component.error()).not.toBe('');
    expect(component.recordingGame()).toBe(mockGame);
    expect(component.finalizingGame()).toBe(false);
  });

  it('onOpenJournal charge le journal de la partie', () => {
    fixture.detectChanges();

    component.onOpenJournal(mockGame);

    expect(mockService.getGameJournal).toHaveBeenCalledWith(1, 10);
    expect(component.journalGame()).toEqual(mockGame);
    expect(component.journalEntries()).toEqual([
      { participantId: 1, userName: 'Ada Lovelace', teamName: 'Les Furieux', description: 'Classé 1 (+10 PC)', createdAt: '2026-07-01T00:00:00.000Z' },
    ]);
    expect(component.loadingJournal()).toBe(false);
  });

  it('onOpenJournal affiche une erreur si le chargement échoue', () => {
    mockService.getGameJournal.mockReturnValue(throwError(() => new Error('boom')));
    fixture.detectChanges();

    component.onOpenJournal(mockGame);

    expect(component.error()).not.toBe('');
    expect(component.loadingJournal()).toBe(false);
  });

  it('onJournalClosed réinitialise l\'état du journal', () => {
    fixture.detectChanges();
    component.onOpenJournal(mockGame);

    component.onJournalClosed();

    expect(component.journalGame()).toBeNull();
    expect(component.journalEntries()).toEqual([]);
    expect(component.loadingJournal()).toBe(false);
  });

  it('anyModalOpen désactive les actions de GameList tant qu\'une pop-up est ouverte', () => {
    fixture.detectChanges();
    expect(component.anyModalOpen()).toBe(false);

    component.recordingGame.set(mockGame);
    fixture.detectChanges();
    expect(component.anyModalOpen()).toBe(true);
    const gameList = fixture.nativeElement.querySelector('app-game-list button');
    expect(gameList).toBeNull();

    component.onWizardCancelled();
    component.openCreate();
    fixture.detectChanges();
    expect(component.anyModalOpen()).toBe(true);
    expect(fixture.nativeElement.querySelector('.campaign-program__add')).toBeNull();
  });
});
