import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { GameResultForm } from './game-result-form';
import { outputToObservable } from '@angular/core/rxjs-interop';

const mockParticipants = [
  { id: 1, teamName: 'Équipe Alpha', userName: 'Alice', status: 'VALIDATED', isOrganizer: false } as any,
  { id: 2, teamName: 'Équipe Beta', userName: 'Bob', status: 'VALIDATED', isOrganizer: false } as any,
  { id: 3, teamName: 'Équipe Gamma', userName: 'Carol', status: 'VALIDATED', isOrganizer: false } as any,
];

describe('GameResultForm', () => {
  let fixture: ComponentFixture<GameResultForm>;
  let component: GameResultForm;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameResultForm],
      providers: [provideNoopAnimations()],
    }).compileComponents();
    fixture = TestBed.createComponent(GameResultForm);
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

  it('cocher un participant le déplace dans la zone de classement', () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].click();
    fixture.detectChanges();
    expect(component.presentParticipants().length).toBe(1);
  });

  it('décocher un participant le retire de la zone de classement', () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].click();
    fixture.detectChanges();
    checkboxes[0].click();
    fixture.detectChanges();
    expect(component.presentParticipants().length).toBe(0);
  });

  it('bouton Valider désactivé si aucune équipe cochée', () => {
    const submitBtn: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(submitBtn.disabled).toBe(true);
  });

  it('bouton Valider actif si au moins une équipe cochée', () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].click();
    fixture.detectChanges();
    const submitBtn: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(submitBtn.disabled).toBe(false);
  });

  it('saved émet les rangs dans l\'ordre de la liste', () => {
    const emitted: any[] = [];
    outputToObservable(component.saved).subscribe(v => emitted.push(v));

    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].click();
    checkboxes[1].click();
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button[type="submit"]').click();
    fixture.detectChanges();

    expect(emitted).toHaveLength(1);
    expect(emitted[0].results[0]).toMatchObject({ participantId: 1, rank: 1 });
    expect(emitted[0].results[1]).toMatchObject({ participantId: 2, rank: 2 });
  });

  it('formCancel émet void au clic Annuler', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.formCancel).subscribe(() => emitted.push(true));
    fixture.nativeElement.querySelector('button[type="button"]').click();
    expect(emitted).toHaveLength(1);
  });

  it('badge classé/non-classé correct : 3 présents → 2 classés', () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    [0, 1, 2].forEach(i => { checkboxes[i].click(); });
    fixture.detectChanges();
    expect(component.classifiedCount()).toBe(2);
  });
});
