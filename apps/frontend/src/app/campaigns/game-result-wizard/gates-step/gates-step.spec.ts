import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GatesStep } from './gates-step';
import { outputToObservable } from '@angular/core/rxjs-interop';
import type { CampaignParticipant } from '../../campaign-participant.model';
import type { GatesEntry } from '../../game.model';

const mockParticipants: CampaignParticipant[] = [
  { id: 1, userId: 1, teamId: 1, teamName: 'Équipe Alpha', userName: 'Alice', status: 'VALIDATED', isOrganizer: false },
  { id: 2, userId: 2, teamId: 2, teamName: 'Équipe Beta', userName: 'Bob', status: 'VALIDATED', isOrganizer: false },
];

describe('GatesStep', () => {
  let fixture: ComponentFixture<GatesStep>;
  let component: GatesStep;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GatesStep],
    }).compileComponents();
    fixture = TestBed.createComponent(GatesStep);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();
  });

  it('affiche un champ par participant, initialisé à 0', () => {
    expect(component.gatesCrossedFor(1)).toBe(0);
    expect(component.gatesCrossedFor(2)).toBe(0);
  });

  it('setGatesCrossed met à jour la valeur du participant', () => {
    component.setGatesCrossed(1, '3');
    expect(component.gatesCrossedFor(1)).toBe(3);
  });

  it('setGatesCrossed clampe les valeurs négatives à 0', () => {
    component.setGatesCrossed(1, '-5');
    expect(component.gatesCrossedFor(1)).toBe(0);
  });

  it('next n\'inclut que les participants avec gatesCrossed > 0', () => {
    component.setGatesCrossed(1, '3');
    const emitted: GatesEntry[][] = [];
    outputToObservable(component.next).subscribe(v => emitted.push(v));
    component.onNext();
    expect(emitted[0]).toEqual([{ participantId: 1, gatesCrossed: 3 }]);
  });

  it('next émet un tableau vide si aucune porte franchie', () => {
    const emitted: GatesEntry[][] = [];
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
