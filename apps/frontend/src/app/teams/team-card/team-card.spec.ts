/**
 * Tests unitaires pour TeamCard.
 *
 * TeamCard est un composant "dumb" : on vérifie uniquement
 * - qu'il affiche correctement les données reçues en input
 * - qu'il émet cardClicked au clic sur la carte
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { TeamCard } from './team-card';
import { Team } from '../team.model';
import { VehicleSummary } from '../vehicle-summary';

const mockTeam: Team = {
  id: 1,
  name: 'Les Furieux du Désert',
  sponsor: 'Rutherford',
  cans: 50,
  description: 'Une équipe redoutable',
  userId: 42,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const mockVehicleSummaries: VehicleSummary[] = [
  { id: 1, nom: 'Camion', cout: 21, emplacementsUtilises: 2, emplacementsTotal: 3 },
  { id: 2, nom: 'Monster Truck', cout: 28, emplacementsUtilises: 3, emplacementsTotal: 4 },
];

describe('TeamCard', () => {
  let component: TeamCard;
  let fixture: ComponentFixture<TeamCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeamCard],
    }).compileComponents();

    fixture = TestBed.createComponent(TeamCard);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('team', mockTeam);
    fixture.detectChanges();
  });

  // ── Affichage ──────────────────────────────────────────────────────────────

  it('affiche le nom de l\'équipe', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.team-card__name')?.textContent).toContain('Les Furieux du Désert');
  });

  it('affiche le sponsor dans le badge', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.team-card__badge')?.textContent).toContain('Rutherford');
  });

  it('affiche le budget en jerricans', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.team-card__cans')?.textContent).toContain('50');
  });

  it('affiche la description si elle est présente', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.team-card__description')?.textContent).toContain('Une équipe redoutable');
  });

  it('n\'affiche pas la description si elle est absente', () => {
    fixture.componentRef.setInput('team', { ...mockTeam, description: undefined });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.team-card__description')).toBeNull();
  });

  // ── Liste des véhicules ────────────────────────────────────────────────────

  it('n\'affiche pas la liste des véhicules par défaut (input vide)', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.team-card__vehicles')).toBeNull();
  });

  it('affiche le nom, le coût et les emplacements de chaque véhicule', () => {
    fixture.componentRef.setInput('vehicles', mockVehicleSummaries);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.team-card__vehicle');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('Camion');
    expect(items[0].textContent).toContain('21');
    expect(items[0].textContent).toContain('2');
    expect(items[0].textContent).toContain('3');
    expect(items[1].textContent).toContain('Monster Truck');
    expect(items[1].textContent).toContain('28');
  });

  // ── Output cardClicked ─────────────────────────────────────────────────────

  it('émet cardClicked avec l\'équipe au clic sur la carte', () => {
    const emitted: Team[] = [];
    outputToObservable(component.cardClicked).subscribe((t) => emitted.push(t));

    const card = fixture.nativeElement.querySelector('.team-card') as HTMLElement;
    card.click();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual(mockTeam);
  });

  it('n\'a pas de boutons d\'action (éditer / supprimer / ajouter véhicule)', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.btn-action--edit')).toBeNull();
    expect(el.querySelector('.btn-action--delete')).toBeNull();
    expect(el.querySelector('.btn-add-vehicle')).toBeNull();
  });
});
