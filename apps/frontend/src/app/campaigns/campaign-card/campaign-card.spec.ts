/**
 * Tests unitaires pour CampaignCard.
 *
 * Composant "dumb" : on vérifie uniquement l'affichage des données reçues en input.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CampaignCard } from './campaign-card';
import { Campaign } from '../campaign.model';

const mockCampaign: Campaign = {
  id: 1,
  name: 'Coupe Verney',
  state: 'EN_CONSTRUCTION',
  inviteCode: 'abcdef123456',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  participantCount: 1,
  myRole: 'organizer',
};

describe('CampaignCard', () => {
  let component: CampaignCard;
  let fixture: ComponentFixture<CampaignCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CampaignCard],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(CampaignCard);
    component = fixture.componentInstance;
  });

  it('affiche le nom et l\'état de la saison', () => {
    fixture.componentRef.setInput('campaign', mockCampaign);
    fixture.detectChanges();

    expect(component.campaign()).toEqual(mockCampaign);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.campaign-card__name')?.textContent).toContain('Coupe Verney');
    expect(el.querySelector('.campaign-card__state')?.textContent).toContain('EN_CONSTRUCTION');
  });

  it('affiche le badge "Organisateur" quand myRole === "organizer"', () => {
    fixture.componentRef.setInput('campaign', mockCampaign);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.campaign-card__badge')?.textContent).toContain('Organisateur');
  });

  it('masque le badge "Organisateur" quand myRole === "participant"', () => {
    fixture.componentRef.setInput('campaign', { ...mockCampaign, myRole: 'participant' });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.campaign-card__badge--organizer')).toBeNull();
  });

  it('affiche le nombre de participants', () => {
    fixture.componentRef.setInput('campaign', { ...mockCampaign, participantCount: 3 });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.campaign-card__participants')?.textContent).toContain('3 participants');
  });

  // ── Badge "En attente" (US4) ────────────────────────────────────────────

  it('affiche le badge "En attente" quand isPending() est vrai (myRole participant)', () => {
    fixture.componentRef.setInput('campaign', { ...mockCampaign, myRole: 'participant' });
    fixture.componentRef.setInput('isPending', true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.campaign-card__badge--pending')).not.toBeNull();
    expect(el.querySelector('.campaign-card__badge--pending')?.textContent).toContain('En attente');
  });

  it('masque le badge "En attente de validation" par défaut', () => {
    fixture.componentRef.setInput('campaign', mockCampaign);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.campaign-card__badge--pending')).toBeNull();
  });

  // ── Badge "N à valider" (US4) ────────────────────────────────────────────

  it('affiche le badge "N à valider" quand organisateur et pendingRequestsCount > 0', () => {
    fixture.componentRef.setInput('campaign', mockCampaign); // myRole: 'organizer'
    fixture.componentRef.setInput('pendingRequestsCount', 2);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.campaign-card__badge--alert')?.textContent).toContain('2 à valider');
  });

  it('masque le badge "N à valider" quand pendingRequestsCount === 0', () => {
    fixture.componentRef.setInput('campaign', mockCampaign);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.campaign-card__badge--alert')).toBeNull();
  });

  it('masque le badge "N à valider" quand l\'utilisateur n\'est pas organisateur', () => {
    fixture.componentRef.setInput('campaign', { ...mockCampaign, myRole: 'participant' });
    fixture.componentRef.setInput('pendingRequestsCount', 2);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.campaign-card__badge--alert')).toBeNull();
  });

  // ── Carte non cliquable si demande PENDING (US4) ────────────────────────

  it('rend la carte sous forme de lien (routerLink) quand isPending() est faux', () => {
    fixture.componentRef.setInput('campaign', mockCampaign);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('a.campaign-card')).not.toBeNull();
    expect(el.querySelector('.campaign-card--locked')).toBeNull();
  });

  it('rend la carte sous forme de div non cliquable quand isPending() est vrai', () => {
    fixture.componentRef.setInput('campaign', mockCampaign);
    fixture.componentRef.setInput('isPending', true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('a.campaign-card')).toBeNull();
    expect(el.querySelector('div.campaign-card--locked')).not.toBeNull();
  });
});
