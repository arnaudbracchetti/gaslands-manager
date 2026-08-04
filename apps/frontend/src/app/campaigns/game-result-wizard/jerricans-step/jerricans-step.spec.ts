import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JerricansStep } from './jerricans-step';
import { outputToObservable } from '@angular/core/rxjs-interop';
import type { CampaignParticipant } from '../../campaign-participant.model';
import type { JerricanGainDto } from '../../game.model';

const mockParticipants: CampaignParticipant[] = [
  { id: 1, userId: 1, teamId: 1, teamName: 'Équipe Alpha', userName: 'Alice', status: 'VALIDATED', isOrganizer: false },
  { id: 2, userId: 2, teamId: 2, teamName: 'Équipe Beta', userName: 'Bob', status: 'VALIDATED', isOrganizer: false },
];

describe('JerricansStep', () => {
  let fixture: ComponentFixture<JerricansStep>;
  let component: JerricansStep;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JerricansStep],
    }).compileComponents();
    fixture = TestBed.createComponent(JerricansStep);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();
  });

  it('affiche un champ par participant, initialisé à 0', () => {
    expect(component.amountFor(1)).toBe(0);
    expect(component.amountFor(2)).toBe(0);
  });

  it('setAmount met à jour le montant du participant', () => {
    component.setAmount(1, '5');
    expect(component.amountFor(1)).toBe(5);
  });

  it('setAmount clampe les valeurs négatives à 0', () => {
    component.setAmount(1, '-2');
    expect(component.amountFor(1)).toBe(0);
  });

  it('next n\'inclut que les participants avec un montant > 0', () => {
    component.setAmount(2, '5');
    const emitted: JerricanGainDto[][] = [];
    outputToObservable(component.next).subscribe(v => emitted.push(v));
    component.onNext();
    expect(emitted[0]).toEqual([{ participantId: 2, amount: 5 }]);
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
