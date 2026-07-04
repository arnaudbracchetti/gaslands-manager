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
  { nom: 'La Course de la Mort', nom_interne: 'course_de_la_mort', type: 'EVENEMENT_TELE', description: '' },
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
    getParticipants: ReturnType<typeof vi.fn>;
    recordResult: ReturnType<typeof vi.fn>;
    getParticipantVehicles: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockService = {
      getGames: vi.fn().mockReturnValue(of([mockGame])),
      getScenarios: vi.fn().mockReturnValue(of(mockScenarios)),
      createGame: vi.fn().mockReturnValue(of(mockGame)),
      updateGame: vi.fn().mockReturnValue(of(mockGame)),
      deleteGame: vi.fn().mockReturnValue(of(undefined)),
      getParticipants: vi.fn().mockReturnValue(of([])),
      recordResult: vi.fn().mockReturnValue(of({ ...mockGame, status: 'JOUE' })),
      getParticipantVehicles: vi.fn().mockReturnValue(of([
        { participantId: 1, vehicles: [{ vehicleId: 100, nom: 'Voiture', weightClass: 'MOYEN' }] },
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

  it('affiche une erreur si le chargement échoue', () => {
    mockService.getGames.mockReturnValue(throwError(() => new Error('boom')));

    fixture.detectChanges();

    expect(component.error()).not.toBe('');
    expect(component.loading()).toBe(false);
  });

  it('affiche GameResultForm en popup, sans masquer GameList', () => {
    fixture.detectChanges();
    component.recordingGame.set(mockGame);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-game-result-form')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-game-list')).toBeTruthy();
  });

  it('onRecordGame met à jour recordingGame', () => {
    const game = { id: 2, status: 'PLANIFIE' } as any;
    component.onRecordGame(game);
    expect(component.recordingGame()).toEqual(game);
  });

  it('onResultCancelled remet recordingGame à null', () => {
    component.recordingGame.set({ id: 1 } as any);
    component.onResultCancelled();
    expect(component.recordingGame()).toBeNull();
  });

  it('onPresentParticipantsChanged charge les véhicules des participants indiqués', () => {
    component.recordingGame.set(mockGame);
    component.onPresentParticipantsChanged([1]);

    expect(mockService.getParticipantVehicles).toHaveBeenCalledWith(1, 10, [1]);
    expect(component.participantVehicles().get(1)).toEqual([
      { vehicleId: 100, nom: 'Voiture', weightClass: 'MOYEN' },
    ]);
  });

  it('onPresentParticipantsChanged vide la map si aucun participant présent', () => {
    component.recordingGame.set(mockGame);
    component.onPresentParticipantsChanged([1]);
    component.onPresentParticipantsChanged([]);

    expect(component.participantVehicles().size).toBe(0);
  });

  it('émet resultRecorded après l\'enregistrement réussi d\'un résultat', () => {
    fixture.detectChanges();
    component.recordingGame.set(mockGame);

    let emittedCount = 0;
    outputToObservable(component.resultRecorded).subscribe(() => { emittedCount++; });

    component.onResultSaved({ results: [] });

    expect(mockService.recordResult).toHaveBeenCalledWith(1, 10, { results: [] });
    expect(emittedCount).toBe(1);
  });

  it('n\'émet pas resultRecorded si l\'enregistrement du résultat échoue', () => {
    mockService.recordResult.mockReturnValue(throwError(() => new Error('boom')));
    fixture.detectChanges();
    component.recordingGame.set(mockGame);

    let emittedCount = 0;
    outputToObservable(component.resultRecorded).subscribe(() => { emittedCount++; });

    component.onResultSaved({ results: [] });

    expect(emittedCount).toBe(0);
  });

  it('anyModalOpen désactive les actions de GameList tant qu\'une pop-up est ouverte', () => {
    fixture.detectChanges();
    expect(component.anyModalOpen()).toBe(false);

    component.recordingGame.set(mockGame);
    fixture.detectChanges();
    expect(component.anyModalOpen()).toBe(true);
    const gameList = fixture.nativeElement.querySelector('app-game-list button');
    expect(gameList).toBeNull();

    component.onResultCancelled();
    component.openCreate();
    fixture.detectChanges();
    expect(component.anyModalOpen()).toBe(true);
    expect(fixture.nativeElement.querySelector('.campaign-program__add')).toBeNull();
  });
});
