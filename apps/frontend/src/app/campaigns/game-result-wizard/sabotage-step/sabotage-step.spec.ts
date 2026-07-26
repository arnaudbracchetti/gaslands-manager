import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SabotageStep } from './sabotage-step';
import { outputToObservable } from '@angular/core/rxjs-interop';

const mockParticipants = [
  { id: 1, teamName: 'Équipe Alpha', userName: 'Alice', status: 'VALIDATED', isOrganizer: false } as any,
  { id: 2, teamName: 'Équipe Beta', userName: 'Bob', status: 'VALIDATED', isOrganizer: false } as any,
];

describe('SabotageStep', () => {
  let fixture: ComponentFixture<SabotageStep>;
  let component: SabotageStep;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SabotageStep],
    }).compileComponents();
    fixture = TestBed.createComponent(SabotageStep);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();
  });

  it('affiche un champ par participant, initialisé à 0', () => {
    expect(component.pointsSpentFor(1)).toBe(0);
    expect(component.pointsSpentFor(2)).toBe(0);
  });

  it('setPointsSpent met à jour le montant du participant', () => {
    component.setPointsSpent(1, '2');
    expect(component.pointsSpentFor(1)).toBe(2);
  });

  it('setPointsSpent clampe les valeurs négatives à 0', () => {
    component.setPointsSpent(1, '-3');
    expect(component.pointsSpentFor(1)).toBe(0);
  });

  it('next n\'inclut que les participants avec un montant > 0', () => {
    component.setPointsSpent(2, '3');
    const emitted: any[] = [];
    outputToObservable(component.next).subscribe(v => emitted.push(v));
    component.onNext();
    expect(emitted[0]).toEqual([{ participantId: 2, pointsSpent: 3 }]);
  });

  it('next émet un tableau vide si rien n\'a été déclaré (clic "Suivant" sans saisie)', () => {
    const emitted: any[] = [];
    outputToObservable(component.next).subscribe(v => emitted.push(v));
    component.onNext();
    expect(emitted[0]).toEqual([]);
  });

  it('back émet void', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.back).subscribe(() => emitted.push(true));
    component.onBack();
    expect(emitted).toHaveLength(1);
  });

  it('formCancel émet void', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.formCancel).subscribe(() => emitted.push(true));
    component.onCancel();
    expect(emitted).toHaveLength(1);
  });
});
