import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { GameResultWizard } from './game-result-wizard';
import { outputToObservable } from '@angular/core/rxjs-interop';
import type { Game, RecordResultDto, WreckResolveRequestDto } from '../game.model';

const mockParticipants = [
  { id: 1, teamName: 'Équipe Alpha', userName: 'Alice', status: 'VALIDATED', isOrganizer: false } as any,
  { id: 2, teamName: 'Équipe Beta', userName: 'Bob', status: 'VALIDATED', isOrganizer: false } as any,
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

const mockVehicles = new Map([
  [1, [{ vehicleId: 100, nom: 'Voiture Alpha', weightClass: 'MOYEN' as const }]],
  [2, [{ vehicleId: 200, nom: 'Buggy Beta', weightClass: 'LEGER' as const }]],
]);

describe('GameResultWizard', () => {
  let fixture: ComponentFixture<GameResultWizard>;
  let component: GameResultWizard;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameResultWizard],
      providers: [provideNoopAnimations()],
    }).compileComponents();
    fixture = TestBed.createComponent(GameResultWizard);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('game', mockGame);
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.componentRef.setInput('participantVehicles', mockVehicles);
    fixture.detectChanges();
  });

  it('démarre à l\'écran 1 (classement)', () => {
    expect(component.currentStep()).toBe(1);
  });

  it('onRankingNext avance vers l\'écran 2', () => {
    component.onRankingNext([{ participantId: 1, rank: 1 }, { participantId: 2, rank: 2 }]);
    expect(component.currentStep()).toBe(2);
  });

  it('presentParticipantsForDesignation ne contient que les participants classés à l\'écran 1', () => {
    component.onRankingNext([{ participantId: 1, rank: 1 }]);
    expect(component.presentParticipantsForDesignation().map((p) => p.id)).toEqual([1]);
  });

  it('onDesignationNext fusionne classement et destroyedVehicles dans rankingSubmitted', () => {
    component.onRankingNext([
      { participantId: 1, rank: 1, gatesCrossed: 3 },
      { participantId: 2, rank: 2 },
    ]);

    const emitted: RecordResultDto[] = [];
    outputToObservable(component.rankingSubmitted).subscribe((v) => emitted.push(v));

    component.onDesignationNext({
      destroyedVehicles: new Map([[1, [{ vehicleId: 200, weightClass: 'LEGER' }]]]),
      wreckedVehicles: [{ participantId: 2, vehicleId: 200, pendingFavoriDuPublic: false }],
    });

    expect(emitted).toHaveLength(1);
    expect(emitted[0].results).toEqual([
      { participantId: 1, rank: 1, gatesCrossed: 3, destroyedVehicles: [{ vehicleId: 200, weightClass: 'LEGER' }] },
      { participantId: 2, rank: 2, gatesCrossed: undefined, destroyedVehicles: undefined },
    ]);
  });

  it('onDesignationNext ne fait pas avancer le wizard tant que resultRecorded n\'est pas confirmé', () => {
    component.onRankingNext([{ participantId: 1, rank: 1 }]);
    component.onDesignationNext({ destroyedVehicles: new Map(), wreckedVehicles: [] });
    expect(component.currentStep()).toBe(2);
  });

  it('avance vers l\'écran 3 quand resultRecorded devient non-null', () => {
    component.onRankingNext([{ participantId: 1, rank: 1 }]);
    component.onDesignationNext({
      destroyedVehicles: new Map(),
      wreckedVehicles: [{ participantId: 1, vehicleId: 100, pendingFavoriDuPublic: false }],
    });
    fixture.componentRef.setInput('resultRecorded', mockGame);
    fixture.detectChanges();
    expect(component.currentStep()).toBe(3);
  });

  it('onDesignationBack revient à l\'écran 1', () => {
    component.onRankingNext([{ participantId: 1, rank: 1 }]);
    component.onDesignationBack();
    expect(component.currentStep()).toBe(1);
  });

  it('vehicleLabels résout "nom (équipe)" depuis participantVehicles', () => {
    expect(component.vehicleLabels().get(100)).toBe('Voiture Alpha (Équipe Alpha)');
  });

  it('déclenche automatiquement un tirage pour le premier véhicule non résolu à l\'arrivée sur l\'écran 3', () => {
    const emitted: WreckResolveRequestDto[] = [];
    outputToObservable(component.wreckRollRequested).subscribe((v) => emitted.push(v));

    component.onRankingNext([{ participantId: 1, rank: 1 }]);
    component.onDesignationNext({
      destroyedVehicles: new Map(),
      wreckedVehicles: [{ participantId: 1, vehicleId: 100, pendingFavoriDuPublic: true }],
    });
    fixture.componentRef.setInput('resultRecorded', mockGame);
    fixture.detectChanges();

    expect(emitted).toEqual([{ participantId: 1, vehicleId: 100, pendingFavoriDuPublic: true }]);
  });

  it('n\'enchaîne pas un nouveau tirage tant que rollingWreck est vrai', () => {
    const emitted: WreckResolveRequestDto[] = [];
    outputToObservable(component.wreckRollRequested).subscribe((v) => emitted.push(v));

    component.onRankingNext([{ participantId: 1, rank: 1 }]);
    component.onDesignationNext({
      destroyedVehicles: new Map(),
      wreckedVehicles: [{ participantId: 1, vehicleId: 100, pendingFavoriDuPublic: false }],
    });
    fixture.componentRef.setInput('rollingWreck', true);
    fixture.componentRef.setInput('resultRecorded', mockGame);
    fixture.detectChanges();

    expect(emitted).toHaveLength(0);
  });

  it('enchaîne sur le véhicule suivant une fois le précédent résolu', () => {
    const emitted: WreckResolveRequestDto[] = [];
    outputToObservable(component.wreckRollRequested).subscribe((v) => emitted.push(v));

    component.onRankingNext([{ participantId: 1, rank: 1 }, { participantId: 2, rank: 2 }]);
    component.onDesignationNext({
      destroyedVehicles: new Map(),
      wreckedVehicles: [
        { participantId: 1, vehicleId: 100, pendingFavoriDuPublic: false },
        { participantId: 2, vehicleId: 200, pendingFavoriDuPublic: false },
      ],
    });
    fixture.componentRef.setInput('resultRecorded', mockGame);
    fixture.detectChanges();

    fixture.componentRef.setInput('wreckOutcomes', new Map([[100, {
      vehicleId: 100, diceRoll: 3, chocsBefore: 0, wreckResult: 'INDEMNE', chocsGained: 0, lostEquipment: null,
    }]]));
    fixture.detectChanges();

    expect(emitted).toEqual([
      { participantId: 1, vehicleId: 100, pendingFavoriDuPublic: false },
      { participantId: 2, vehicleId: 200, pendingFavoriDuPublic: false },
    ]);
  });

  it('destroyedBy résout le libellé du destructeur depuis destroyedVehicles (écran 2)', () => {
    component.onRankingNext([{ participantId: 1, rank: 1 }, { participantId: 2, rank: 2 }]);
    component.onDesignationNext({
      destroyedVehicles: new Map([[1, [{ vehicleId: 200, weightClass: 'LEGER' }]]]),
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
