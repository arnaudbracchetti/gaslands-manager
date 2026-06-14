/**
 * Tests unitaires pour ParticipantList.
 *
 * Composant "dumb" : affichage des lignes + émission de l'événement `validate`
 * au clic sur Valider/Refuser (cf. invite-link.spec.ts pour le pattern
 * input()/output()).
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

  it('affiche le nom de l\'utilisateur et de l\'équipe pour chaque participant', () => {
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.participant-list__item');
    expect(items.length).toBe(2);
    expect(items[0].querySelector('.participant-list__user')?.textContent).toContain('Jean Dupont');
    expect(items[0].querySelector('.participant-list__team')?.textContent).toContain('Furies');
  });

  it('affiche le badge "Organisateur" pour un participant organisateur', () => {
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.participant-list__item');
    expect(items[0].querySelector('.participant-list__badge')?.textContent).toContain('Organisateur');
    expect(items[1].querySelector('.participant-list__badge')).toBeNull();
  });

  it('masque les boutons Valider/Refuser quand showActions est false (défaut)', () => {
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.participant-list__validate')).toBeNull();
    expect(el.querySelector('.participant-list__reject')).toBeNull();
  });

  it('affiche les boutons Valider/Refuser et émet `validate` au clic quand showActions est true', () => {
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.componentRef.setInput('showActions', true);
    fixture.detectChanges();

    const emitted: { pid: number; accept: boolean }[] = [];
    outputToObservable(component.validate).subscribe((e) => emitted.push(e));

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.participant-list__item');

    (items[0].querySelector('.participant-list__validate') as HTMLButtonElement).click();
    (items[1].querySelector('.participant-list__reject') as HTMLButtonElement).click();

    expect(emitted).toEqual([
      { pid: 1, accept: true },
      { pid: 2, accept: false },
    ]);
  });

  it('masque le bouton Retirer quand canRemove est false (défaut)', () => {
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.participant-list__remove')).toBeNull();
  });

  it('affiche le bouton Retirer et émet `remove` au clic quand canRemove est true', () => {
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.componentRef.setInput('canRemove', true);
    fixture.detectChanges();

    const emitted: number[] = [];
    outputToObservable(component.remove).subscribe((pid) => emitted.push(pid));

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.participant-list__item');

    (items[1].querySelector('.participant-list__remove') as HTMLButtonElement).click();

    expect(emitted).toEqual([2]);
  });

  it('masque le bouton Retirer pour l\'unique organisateur de la liste (CA4)', () => {
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.componentRef.setInput('canRemove', true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.participant-list__item');

    expect(items[0].querySelector('.participant-list__remove')).toBeNull();
    expect(items[1].querySelector('.participant-list__remove')).not.toBeNull();
  });

  it('affiche le bouton Retirer pour un organisateur s\'il en reste un autre (CA5)', () => {
    const twoOrganizers: SeasonParticipant[] = [
      { ...mockParticipants[0] },
      { ...mockParticipants[1], isOrganizer: true, status: 'VALIDATED' },
    ];
    fixture.componentRef.setInput('participants', twoOrganizers);
    fixture.componentRef.setInput('canRemove', true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.participant-list__item');

    expect(items[0].querySelector('.participant-list__remove')).not.toBeNull();
    expect(items[1].querySelector('.participant-list__remove')).not.toBeNull();
  });

  it('affiche un message si la liste est vide', () => {
    fixture.componentRef.setInput('participants', []);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.participant-list__empty')).not.toBeNull();
  });
});
