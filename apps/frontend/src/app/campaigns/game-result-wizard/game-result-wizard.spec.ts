import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameResultWizard } from './game-result-wizard';
import { outputToObservable } from '@angular/core/rxjs-interop';
import type { Game, RecordResultDto, WreckResolveRequestDto } from '../game.model';

const mockParticipants = [
  { id: 1, teamName: 'Équipe Alpha', userName: 'Alice', status: 'VALIDATED', isOrganizer: false } as any,
  { id: 2, teamName: 'Équipe Beta', userName: 'Bob', status: 'VALIDATED', isOrganizer: false } as any,
];

const mockEvenementTele: Game = {
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

const mockEscarmouche: Game = {
  id: 20,
  campaignId: 1,
  scenarioId: 'pillage_de_convoi',
  scenarioName: 'Pillage de Convoi',
  type: 'ESCARMOUCHE',
  status: 'PLANIFIE',
  order: 1,
  playedAt: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  franchissementPortes: false,
  gainJerricans: true,
};

const mockVehicles = new Map([
  [1, [{ vehicleId: 100, nom: 'Voiture Alpha', weightClass: 'MOYEN' as const, hasFavoriDuPublic: false }]],
  [2, [{ vehicleId: 200, nom: 'Buggy Beta', weightClass: 'LEGER' as const, hasFavoriDuPublic: false }]],
]);

describe('GameResultWizard — Événement Télévisé', () => {
  let fixture: ComponentFixture<GameResultWizard>;
  let component: GameResultWizard;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameResultWizard],
    }).compileComponents();
    fixture = TestBed.createComponent(GameResultWizard);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('game', mockEvenementTele);
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.componentRef.setInput('participantVehicles', mockVehicles);
    fixture.detectChanges();
  });

  it('démarre à l\'écran présence', () => {
    expect(component.currentStepId()).toBe('presence');
  });

  it('activeSteps inclut classement + portes (franchissementPortes) pour un ET', () => {
    expect(component.activeSteps()).toEqual(['presence', 'ranking', 'gates', 'designation', 'resolution']);
  });

  it('activeSteps omet portes si franchissementPortes est faux', () => {
    fixture.componentRef.setInput('game', { ...mockEvenementTele, franchissementPortes: false });
    expect(component.activeSteps()).toEqual(['presence', 'ranking', 'designation', 'resolution']);
  });

  it('onPresenceNext avance vers classement', () => {
    component.onPresenceNext([1, 2]);
    expect(component.currentStepId()).toBe('ranking');
  });

  it('onRankingNext avance vers portes', () => {
    component.onPresenceNext([1, 2]);
    component.onRankingNext([{ participantId: 1, rank: 1 }, { participantId: 2, rank: 2 }]);
    expect(component.currentStepId()).toBe('gates');
  });

  it('onGatesNext avance vers désignation', () => {
    component.onPresenceNext([1, 2]);
    component.onRankingNext([{ participantId: 1, rank: 1 }, { participantId: 2, rank: 2 }]);
    component.onGatesNext([{ participantId: 1, gatesCrossed: 3 }]);
    expect(component.currentStepId()).toBe('designation');
  });

  it('goBack revient à l\'étape précédente', () => {
    component.onPresenceNext([1, 2]);
    component.onRankingNext([{ participantId: 1, rank: 1 }, { participantId: 2, rank: 2 }]);
    component.goBack();
    expect(component.currentStepId()).toBe('ranking');
  });

  it('presentParticipants ne contient que les ids choisis à l\'écran présence', () => {
    component.onPresenceNext([1]);
    expect(component.presentParticipants().map((p) => p.id)).toEqual([1]);
  });

  it('rankedParticipants respecte l\'ordre du classement', () => {
    component.onPresenceNext([1, 2]);
    component.onRankingNext([{ participantId: 2, rank: 1 }, { participantId: 1, rank: 2 }]);
    expect(component.rankedParticipants().map((p) => p.id)).toEqual([2, 1]);
  });

  it('batchReady fusionne classement, portes et destroyedVehicles dans results', () => {
    component.onPresenceNext([1, 2]);
    component.onRankingNext([{ participantId: 1, rank: 1 }, { participantId: 2, rank: 2 }]);
    component.onGatesNext([{ participantId: 1, gatesCrossed: 3 }]);

    const emitted: RecordResultDto[] = [];
    outputToObservable(component.batchReady).subscribe((v) => emitted.push(v));

    component.onDesignationNext({
      destroyedVehicles: new Map([[1, [{ vehicleId: 200 }]]]),
      wreckedVehicles: [{ participantId: 2, vehicleId: 200, pendingFavoriDuPublic: false }],
    });

    expect(emitted).toHaveLength(1);
    expect(emitted[0].results).toEqual([
      { participantId: 1, rank: 1, gatesCrossed: 3, destroyedVehicles: [{ vehicleId: 200 }] },
      { participantId: 2, rank: 2, gatesCrossed: undefined, destroyedVehicles: undefined },
    ]);
    expect(emitted[0].jerricanGains).toBeUndefined();
    expect(emitted[0].destroyedVehicles).toBeUndefined();
  });

  it('onDesignationNext ne fait pas avancer le wizard tant que resultRecorded n\'est pas confirmé', () => {
    component.onPresenceNext([1]);
    component.onRankingNext([{ participantId: 1, rank: 1 }]);
    component.onGatesNext([]);
    component.onDesignationNext({ destroyedVehicles: new Map(), wreckedVehicles: [] });
    expect(component.currentStepId()).toBe('designation');
  });

  it('avance vers résolution quand resultRecorded devient non-null', () => {
    component.onPresenceNext([1]);
    component.onRankingNext([{ participantId: 1, rank: 1 }]);
    component.onGatesNext([]);
    component.onDesignationNext({
      destroyedVehicles: new Map(),
      wreckedVehicles: [{ participantId: 1, vehicleId: 100, pendingFavoriDuPublic: false }],
    });
    fixture.componentRef.setInput('resultRecorded', mockEvenementTele);
    fixture.detectChanges();
    expect(component.currentStepId()).toBe('resolution');
  });

  it('vehicleLabels résout "nom (équipe)" depuis participantVehicles', () => {
    expect(component.vehicleLabels().get(100)).toBe('Voiture Alpha (Équipe Alpha)');
  });

  it('vehicleLabels compose correctement un nom déjà formaté par le backend ("Nom (Type)")', () => {
    fixture.componentRef.setInput('participantVehicles', new Map([
      [1, [{ vehicleId: 100, nom: 'La Teigne (Voiture)', weightClass: 'MOYEN' as const, hasFavoriDuPublic: false }]],
    ]));
    fixture.detectChanges();

    expect(component.vehicleLabels().get(100)).toBe('La Teigne (Voiture) (Équipe Alpha)');
  });

  it('déclenche un tirage d\'épave (pas de revenu, ET) à l\'arrivée sur résolution', () => {
    const incomeEmitted: number[] = [];
    outputToObservable(component.incomeRollRequested).subscribe((v) => incomeEmitted.push(v));
    const wreckEmitted: WreckResolveRequestDto[] = [];
    outputToObservable(component.wreckRollRequested).subscribe((v) => wreckEmitted.push(v));

    component.onPresenceNext([1]);
    component.onRankingNext([{ participantId: 1, rank: 1 }]);
    component.onGatesNext([]);
    component.onDesignationNext({
      destroyedVehicles: new Map(),
      wreckedVehicles: [{ participantId: 1, vehicleId: 100, pendingFavoriDuPublic: true }],
    });
    fixture.componentRef.setInput('resultRecorded', mockEvenementTele);
    fixture.detectChanges();

    expect(incomeEmitted).toHaveLength(0);
    expect(wreckEmitted).toEqual([{ participantId: 1, vehicleId: 100, pendingFavoriDuPublic: true }]);
  });

  it('n\'enchaîne pas un nouveau tirage tant que resolving est vrai', () => {
    const emitted: WreckResolveRequestDto[] = [];
    outputToObservable(component.wreckRollRequested).subscribe((v) => emitted.push(v));

    component.onPresenceNext([1]);
    component.onRankingNext([{ participantId: 1, rank: 1 }]);
    component.onGatesNext([]);
    component.onDesignationNext({
      destroyedVehicles: new Map(),
      wreckedVehicles: [{ participantId: 1, vehicleId: 100, pendingFavoriDuPublic: false }],
    });
    fixture.componentRef.setInput('resolving', true);
    fixture.componentRef.setInput('resultRecorded', mockEvenementTele);
    fixture.detectChanges();

    expect(emitted).toHaveLength(0);
  });

  it('destroyedBy résout le libellé du destructeur depuis destroyedVehicles (écran désignation)', () => {
    component.onPresenceNext([1, 2]);
    component.onRankingNext([{ participantId: 1, rank: 1 }, { participantId: 2, rank: 2 }]);
    component.onGatesNext([]);
    component.onDesignationNext({
      destroyedVehicles: new Map([[1, [{ vehicleId: 200 }]]]),
      wreckedVehicles: [{ participantId: 2, vehicleId: 200, pendingFavoriDuPublic: false }],
    });
    expect(component.destroyedBy().get(200)).toBe('Équipe Alpha');
  });

  it('onWreckCompleted émet wizardCompleted', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.wizardCompleted).subscribe(() => emitted.push(true));
    component.onWreckCompleted();
    expect(emitted).toHaveLength(1);
  });

  it('onCancel émet formCancel', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.formCancel).subscribe(() => emitted.push(true));
    component.onCancel();
    expect(emitted).toHaveLength(1);
  });
});

describe('GameResultWizard — Escarmouche', () => {
  let fixture: ComponentFixture<GameResultWizard>;
  let component: GameResultWizard;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameResultWizard],
    }).compileComponents();
    fixture = TestBed.createComponent(GameResultWizard);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('game', mockEscarmouche);
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.componentRef.setInput('participantVehicles', mockVehicles);
    fixture.detectChanges();
  });

  it('activeSteps omet classement/portes, inclut jerricans (gainJerricans)', () => {
    expect(component.activeSteps()).toEqual(['presence', 'jerricans', 'designation', 'resolution']);
  });

  it('activeSteps omet aussi jerricans si gainJerricans est faux', () => {
    fixture.componentRef.setInput('game', { ...mockEscarmouche, gainJerricans: false });
    expect(component.activeSteps()).toEqual(['presence', 'designation', 'resolution']);
  });

  it('onPresenceNext avance directement vers jerricans (pas de classement)', () => {
    component.onPresenceNext([1, 2]);
    expect(component.currentStepId()).toBe('jerricans');
  });

  it('onJerricansNext avance vers désignation', () => {
    component.onPresenceNext([1, 2]);
    component.onJerricansNext([{ participantId: 1, amount: 5 }]);
    expect(component.currentStepId()).toBe('designation');
  });

  it('batchReady envoie jerricanGains et destroyedVehicles à plat, jamais results', () => {
    component.onPresenceNext([1, 2]);
    component.onJerricansNext([{ participantId: 1, amount: 5 }]);

    const emitted: RecordResultDto[] = [];
    outputToObservable(component.batchReady).subscribe((v) => emitted.push(v));

    component.onDesignationNext({
      destroyedVehicles: new Map([[1, [{ vehicleId: 200 }]]]),
      wreckedVehicles: [{ participantId: 2, vehicleId: 200, pendingFavoriDuPublic: false }],
    });

    expect(emitted).toHaveLength(1);
    expect(emitted[0].results).toBeUndefined();
    expect(emitted[0].jerricanGains).toEqual([{ participantId: 1, amount: 5 }]);
    expect(emitted[0].destroyedVehicles).toEqual([{ destroyerId: 1, vehicleId: 200 }]);
  });

  it('batchReady omet jerricanGains/destroyedVehicles si vides', () => {
    component.onPresenceNext([1]);
    component.onJerricansNext([]);

    const emitted: RecordResultDto[] = [];
    outputToObservable(component.batchReady).subscribe((v) => emitted.push(v));

    component.onDesignationNext({ destroyedVehicles: new Map(), wreckedVehicles: [] });

    expect(emitted[0].jerricanGains).toBeUndefined();
    expect(emitted[0].destroyedVehicles).toBeUndefined();
  });

  it('déclenche un tirage de revenu par participant présent avant les tirages d\'épave', () => {
    const incomeEmitted: number[] = [];
    outputToObservable(component.incomeRollRequested).subscribe((v) => incomeEmitted.push(v));
    const wreckEmitted: WreckResolveRequestDto[] = [];
    outputToObservable(component.wreckRollRequested).subscribe((v) => wreckEmitted.push(v));

    component.onPresenceNext([1, 2]);
    component.onJerricansNext([]);
    component.onDesignationNext({
      destroyedVehicles: new Map(),
      wreckedVehicles: [{ participantId: 1, vehicleId: 100, pendingFavoriDuPublic: false }],
    });
    fixture.componentRef.setInput('resultRecorded', mockEscarmouche);
    fixture.detectChanges();

    // Revenu du premier participant présent demandé d'abord ; pas encore de tirage d'épave.
    expect(incomeEmitted).toEqual([1]);
    expect(wreckEmitted).toHaveLength(0);
  });

  it('enchaîne les tirages d\'épave une fois tous les revenus reçus', () => {
    const wreckEmitted: WreckResolveRequestDto[] = [];
    outputToObservable(component.wreckRollRequested).subscribe((v) => wreckEmitted.push(v));

    component.onPresenceNext([1, 2]);
    component.onJerricansNext([]);
    component.onDesignationNext({
      destroyedVehicles: new Map(),
      wreckedVehicles: [{ participantId: 1, vehicleId: 100, pendingFavoriDuPublic: false }],
    });
    fixture.componentRef.setInput('resultRecorded', mockEscarmouche);
    fixture.componentRef.setInput('incomeResults', new Map([
      [1, { amount: 4, descriptions: [] }],
      [2, { amount: 2, descriptions: [] }],
    ]));
    fixture.detectChanges();

    expect(wreckEmitted).toEqual([{ participantId: 1, vehicleId: 100, pendingFavoriDuPublic: false }]);
  });
});
