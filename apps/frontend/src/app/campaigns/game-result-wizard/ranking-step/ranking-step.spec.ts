import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RankingStep } from './ranking-step';
import { outputToObservable } from '@angular/core/rxjs-interop';
import type { Game } from '../../game.model';

const mockParticipants = [
  { id: 1, teamName: 'Équipe Alpha', userName: 'Alice', status: 'VALIDATED', isOrganizer: false } as any,
  { id: 2, teamName: 'Équipe Beta', userName: 'Bob', status: 'VALIDATED', isOrganizer: false } as any,
  { id: 3, teamName: 'Équipe Gamma', userName: 'Carol', status: 'VALIDATED', isOrganizer: false } as any,
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

describe('RankingStep', () => {
  let fixture: ComponentFixture<RankingStep>;
  let component: RankingStep;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RankingStep],
    }).compileComponents();
    fixture = TestBed.createComponent(RankingStep);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('game', mockGame);
    fixture.componentRef.setInput('presentParticipants', mockParticipants);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();
  });

  it('initialise l\'ordre depuis presentParticipants()', () => {
    expect(component.orderedParticipants().map((p) => p.id)).toEqual([1, 2, 3]);
  });

  it('se ré-initialise si presentParticipants() change', () => {
    fixture.componentRef.setInput('presentParticipants', [mockParticipants[2], mockParticipants[0]]);
    fixture.detectChanges();
    expect(component.orderedParticipants().map((p) => p.id)).toEqual([3, 1]);
  });

  it('bouton Suivant actif dès qu\'il y a des présents', () => {
    const submitBtn: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(submitBtn.disabled).toBe(false);
  });

  it('next émet les rangs dans l\'ordre de la liste', () => {
    const emitted: any[] = [];
    outputToObservable(component.next).subscribe(v => emitted.push(v));

    fixture.nativeElement.querySelector('button[type="submit"]').click();
    fixture.detectChanges();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual([
      { participantId: 1, rank: 1 },
      { participantId: 2, rank: 2 },
      { participantId: 3, rank: 3 },
    ]);
  });

  it('back émet void', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.back).subscribe(() => emitted.push(true));
    component.onBack();
    expect(emitted).toHaveLength(1);
  });

  it('formCancel émet void au clic Annuler', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.formCancel).subscribe(() => emitted.push(true));
    fixture.nativeElement.querySelector('.rst__actions button[type="button"]').click();
    expect(emitted).toHaveLength(1);
  });

  it('badge classé/non-classé correct : 3 présents → 2 classés', () => {
    expect(component.classifiedCount()).toBe(2);
  });

  it('pointsForRank applique le barème 10/5/2/1 pour un Événement Télé', () => {
    expect(component.pointsForRank(1)).toBe(10);
    expect(component.pointsForRank(2)).toBe(5);
    expect(component.pointsForRank(3)).toBe(0);
  });

  it('pointsForRank est toujours 0 pour une Escarmouche', () => {
    fixture.componentRef.setInput('game', { ...mockGame, type: 'ESCARMOUCHE' });
    expect(component.pointsForRank(1)).toBe(0);
  });

  it('moveUp/moveDown permutent les entrées adjacentes', () => {
    component.moveDown(0);
    expect(component.orderedParticipants().map(p => p.id)).toEqual([2, 1, 3]);

    component.moveUp(1);
    expect(component.orderedParticipants().map(p => p.id)).toEqual([1, 2, 3]);
  });

  it('moveUp/moveDown sont des no-op aux bornes de la liste', () => {
    component.moveUp(0);
    expect(component.orderedParticipants().map(p => p.id)).toEqual([1, 2, 3]);

    component.moveDown(2);
    expect(component.orderedParticipants().map(p => p.id)).toEqual([1, 2, 3]);
  });
});
