/**
 * Tests unitaires pour SeasonCard.
 *
 * Composant "dumb" : on vérifie uniquement l'affichage des données reçues en input.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
      providers: [provideRouter([])],
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

  // ── Badge "En attente de validation" (US4) ──────────────────────────────

  it('affiche le badge "En attente de validation" quand isPending() est vrai', () => {
    fixture.componentRef.setInput('season', mockSeason);
    fixture.componentRef.setInput('isPending', true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.season-card__badge--pending')?.textContent).toContain('En attente de validation');
  });

  it('masque le badge "En attente de validation" par défaut', () => {
    fixture.componentRef.setInput('season', mockSeason);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.season-card__badge--pending')).toBeNull();
  });

  // ── Badge "N à valider" (US4) ────────────────────────────────────────────

  it('affiche le badge "N à valider" quand organisateur et pendingRequestsCount > 0', () => {
    fixture.componentRef.setInput('season', mockSeason); // myRole: 'organizer'
    fixture.componentRef.setInput('pendingRequestsCount', 2);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.season-card__badge--alert')?.textContent).toContain('2 à valider');
  });

  it('masque le badge "N à valider" quand pendingRequestsCount === 0', () => {
    fixture.componentRef.setInput('season', mockSeason);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.season-card__badge--alert')).toBeNull();
  });

  it('masque le badge "N à valider" quand l\'utilisateur n\'est pas organisateur', () => {
    fixture.componentRef.setInput('season', { ...mockSeason, myRole: 'participant' });
    fixture.componentRef.setInput('pendingRequestsCount', 2);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.season-card__badge--alert')).toBeNull();
  });

  // ── Carte non cliquable si demande PENDING (US4) ────────────────────────

  it('rend la carte sous forme de lien (routerLink) quand isPending() est faux', () => {
    fixture.componentRef.setInput('season', mockSeason);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('a.season-card')).not.toBeNull();
    expect(el.querySelector('.season-card--locked')).toBeNull();
  });

  it('rend la carte sous forme de div non cliquable quand isPending() est vrai', () => {
    fixture.componentRef.setInput('season', mockSeason);
    fixture.componentRef.setInput('isPending', true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('a.season-card')).toBeNull();
    expect(el.querySelector('div.season-card--locked')).not.toBeNull();
  });
});
