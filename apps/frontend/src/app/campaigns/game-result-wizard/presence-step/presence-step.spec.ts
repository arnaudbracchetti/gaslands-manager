import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PresenceStep } from './presence-step';
import { outputToObservable } from '@angular/core/rxjs-interop';
import type { CampaignParticipant } from '../../campaign-participant.model';

const mockParticipants: CampaignParticipant[] = [
  { id: 1, userId: 1, teamId: 1, teamName: 'Équipe Alpha', userName: 'Alice', status: 'VALIDATED', isOrganizer: false },
  { id: 2, userId: 2, teamId: 2, teamName: 'Équipe Beta', userName: 'Bob', status: 'VALIDATED', isOrganizer: false },
  { id: 3, userId: 3, teamId: 3, teamName: 'Équipe Gamma', userName: 'Carol', status: 'VALIDATED', isOrganizer: false },
];

describe('PresenceStep', () => {
  let fixture: ComponentFixture<PresenceStep>;
  let component: PresenceStep;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PresenceStep],
    }).compileComponents();
    fixture = TestBed.createComponent(PresenceStep);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();
  });

  it('affiche tous les participants avec checkbox décochée', () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes).toHaveLength(3);
    checkboxes.forEach((cb: HTMLInputElement) => expect(cb.checked).toBe(false));
  });

  it('cocher un participant l\'ajoute aux présents', () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].click();
    fixture.detectChanges();
    expect(component.presentIds()).toEqual([1]);
  });

  it('décocher un participant le retire des présents', () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].click();
    fixture.detectChanges();
    checkboxes[0].click();
    fixture.detectChanges();
    expect(component.presentIds()).toEqual([]);
  });

  it('bouton Suivant désactivé si aucune équipe cochée', () => {
    const submitBtn: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(submitBtn.disabled).toBe(true);
  });

  it('bouton Suivant reste désactivé si une seule équipe est cochée (minimum 2)', () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].click();
    fixture.detectChanges();
    const submitBtn: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(submitBtn.disabled).toBe(true);
  });

  it('affiche un avertissement quand une seule équipe est cochée', () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.pst__hint--warning')).toBeTruthy();
  });

  it('bouton Suivant actif dès que deux équipes sont cochées', () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].click();
    checkboxes[1].click();
    fixture.detectChanges();
    const submitBtn: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(submitBtn.disabled).toBe(false);
    expect(fixture.nativeElement.querySelector('.pst__hint--warning')).toBeFalsy();
  });

  it('next émet les ids présents dans l\'ordre de coche', () => {
    const emitted: number[][] = [];
    outputToObservable(component.next).subscribe(v => emitted.push(v));

    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[1].click();
    checkboxes[0].click();
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button[type="submit"]').click();

    expect(emitted).toEqual([[2, 1]]);
  });

  it('cocher/décocher émet presentParticipantsChanged avec les ids présents', () => {
    const emitted: number[][] = [];
    outputToObservable(component.presentParticipantsChanged).subscribe(v => emitted.push(v));

    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].click();
    checkboxes[1].click();
    fixture.detectChanges();

    expect(emitted).toEqual([[1], [1, 2]]);
  });

  it('formCancel émet void au clic Annuler', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.formCancel).subscribe(() => emitted.push(true));
    fixture.nativeElement.querySelector('.pst__actions button[type="button"]').click();
    expect(emitted).toHaveLength(1);
  });
});
