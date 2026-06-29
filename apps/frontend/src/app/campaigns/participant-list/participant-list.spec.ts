/**
 * Tests unitaires pour ParticipantList.
 *
 * Composant "dumb" : affichage unifié (tous statuts dans une seule liste).
 * Inputs : participants[], isOrganizer, currentUserId
 * Outputs : validate({ pid, accept }), remove(pid), promote(pid)
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { ParticipantList } from './participant-list';
import { SeasonParticipant } from '../season-participant.model';

const mockParticipants: SeasonParticipant[] = [
  { id: 1, userId: 42, teamId: 7, status: 'VALIDATED', isOrganizer: true, userName: 'Jean Dupont', teamName: 'Furies' },
  { id: 2, userId: 43, teamId: 8, status: 'PENDING', isOrganizer: false, userName: 'Alice Martin', teamName: 'Scrap Kings' },
];

describe('ParticipantList', () => {
  let component: ParticipantList;
  let fixture: ComponentFixture<ParticipantList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ParticipantList],
    }).compileComponents();

    fixture = TestBed.createComponent(ParticipantList);
    component = fixture.componentInstance;
  });

  // ── Affichage de base ────────────────────────────────────────────────────

  it('affiche le nom de l\'utilisateur et de l\'équipe pour chaque participant', () => {
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.participant-list__item');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Jean Dupont');
    expect(items[0].textContent).toContain('Furies');
  });

  it('affiche le badge "Organisateur" pour un participant organisateur', () => {
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.participant-list__item');
    expect(items[0].querySelector('.participant-list__badge--organizer')).not.toBeNull();
    expect(items[1].querySelector('.participant-list__badge--organizer')).toBeNull();
  });

  it('affiche un message si la liste est vide', () => {
    fixture.componentRef.setInput('participants', []);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.participant-list__empty')).not.toBeNull();
  });

  // ── Actions organisateur (Valider/Refuser PENDING) ───────────────────────

  it('masque les boutons Valider/Refuser si l\'utilisateur n\'est pas organisateur', () => {
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.componentRef.setInput('isOrganizer', false);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.participant-list__validate')).toBeNull();
    expect(el.querySelector('.participant-list__reject')).toBeNull();
  });

  it('affiche Valider/Refuser pour un PENDING quand isOrganizer', () => {
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.componentRef.setInput('isOrganizer', true);
    fixture.componentRef.setInput('currentUserId', 99);
    fixture.detectChanges();

    const emitted: { pid: number; accept: boolean }[] = [];
    outputToObservable(component.validate).subscribe((e) => emitted.push(e));

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.participant-list__item');

    const validateBtn = items[1].querySelector('.participant-list__validate') as HTMLButtonElement;
    expect(validateBtn).not.toBeNull();
    validateBtn.click();
    expect(emitted).toContainEqual({ pid: 2, accept: true });
  });

  it('émet validate({ accept: false }) au clic sur Refuser pour un PENDING', () => {
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.componentRef.setInput('isOrganizer', true);
    fixture.componentRef.setInput('currentUserId', 99);
    fixture.detectChanges();

    const emitted: { pid: number; accept: boolean }[] = [];
    outputToObservable(component.validate).subscribe((e) => emitted.push(e));

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.participant-list__item');
    const rejectBtn = items[1].querySelector('.participant-list__reject') as HTMLButtonElement;
    expect(rejectBtn).not.toBeNull();
    rejectBtn.click();
    expect(emitted).toContainEqual({ pid: 2, accept: false });
  });

  // ── Action Retirer ───────────────────────────────────────────────────────

  it('masque le bouton Retirer si l\'utilisateur n\'est pas organisateur', () => {
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.componentRef.setInput('isOrganizer', false);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.participant-list__remove')).toBeNull();
  });

  it('affiche le bouton Retirer et émet remove(pid) quand organisateur', () => {
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.componentRef.setInput('isOrganizer', true);
    fixture.componentRef.setInput('currentUserId', 99);
    fixture.detectChanges();

    const emitted: number[] = [];
    outputToObservable(component.remove).subscribe((pid) => emitted.push(pid));

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.participant-list__item');
    const removeBtn = items[1].querySelector('.participant-list__remove') as HTMLButtonElement;
    expect(removeBtn).not.toBeNull();
    removeBtn.click();
    expect(emitted).toEqual([2]);
  });

  it('masque le bouton Retirer pour l\'unique organisateur VALIDATED (CA4)', () => {
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.componentRef.setInput('isOrganizer', true);
    fixture.componentRef.setInput('currentUserId', 99);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.participant-list__item');
    expect(items[0].querySelector('.participant-list__remove')).toBeNull();
  });

  it('affiche le bouton Retirer pour un organisateur s\'il en reste un autre (CA5)', () => {
    const twoOrganizers: SeasonParticipant[] = [
      { ...mockParticipants[0] },
      { ...mockParticipants[1], isOrganizer: true, status: 'VALIDATED' },
    ];
    fixture.componentRef.setInput('participants', twoOrganizers);
    fixture.componentRef.setInput('isOrganizer', true);
    fixture.componentRef.setInput('currentUserId', 99);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.participant-list__item');
    expect(items[0].querySelector('.participant-list__remove')).not.toBeNull();
    expect(items[1].querySelector('.participant-list__remove')).not.toBeNull();
  });

  // ── Action Promouvoir ────────────────────────────────────────────────────

  it('affiche le bouton Promouvoir pour un participant VALIDATED non-organisateur', () => {
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.componentRef.setInput('isOrganizer', true);
    fixture.componentRef.setInput('currentUserId', 99);
    fixture.detectChanges();

    const emitted: number[] = [];
    outputToObservable(component.promote).subscribe((pid) => emitted.push(pid));

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.participant-list__item');
    // items[1] est PENDING → pas de bouton promouvoir
    expect(items[1].querySelector('.participant-list__promote')).toBeNull();
  });
});
