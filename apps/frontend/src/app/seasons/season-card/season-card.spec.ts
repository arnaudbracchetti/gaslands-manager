/**
 * Tests unitaires pour SeasonCard.
 *
 * Composant "dumb" : on vérifie uniquement l'affichage des données reçues en input.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SeasonCard } from './season-card';
import { Season } from '../season.model';

const mockSeason: Season = {
  id: 1,
  name: 'Coupe Verney',
  state: 'EN_CONSTRUCTION',
  inviteCode: 'abcdef123456',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  participantCount: 1,
  myRole: 'organizer',
};

describe('SeasonCard', () => {
  let component: SeasonCard;
  let fixture: ComponentFixture<SeasonCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeasonCard],
    }).compileComponents();

    fixture = TestBed.createComponent(SeasonCard);
    component = fixture.componentInstance;
  });

  it('affiche le nom et l\'état de la saison', () => {
    fixture.componentRef.setInput('season', mockSeason);
    fixture.detectChanges();

    expect(component.season()).toEqual(mockSeason);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.season-card__name')?.textContent).toContain('Coupe Verney');
    expect(el.querySelector('.season-card__state')?.textContent).toContain('EN_CONSTRUCTION');
  });

  it('affiche le badge "Organisateur" quand myRole === "organizer"', () => {
    fixture.componentRef.setInput('season', mockSeason);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.season-card__badge')?.textContent).toContain('Organisateur');
  });

  it('masque le badge "Organisateur" quand myRole === "participant"', () => {
    fixture.componentRef.setInput('season', { ...mockSeason, myRole: 'participant' });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.season-card__badge')).toBeNull();
  });

  it('affiche le nombre de participants', () => {
    fixture.componentRef.setInput('season', { ...mockSeason, participantCount: 3 });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.season-card__participants')?.textContent).toContain('3 participants');
  });

  it('affiche le code d\'invitation quand myRole === "organizer"', () => {
    fixture.componentRef.setInput('season', mockSeason);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-invite-link')).not.toBeNull();
  });

  it('masque le code d\'invitation quand myRole === "participant"', () => {
    fixture.componentRef.setInput('season', { ...mockSeason, myRole: 'participant' });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-invite-link')).toBeNull();
  });
});
