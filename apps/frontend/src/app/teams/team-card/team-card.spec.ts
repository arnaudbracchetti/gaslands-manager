/**
 * Tests unitaires pour TeamCard.
 *
 * TeamCard est un composant "dumb" : on vérifie uniquement
 * - qu'il affiche correctement les données reçues en input
 * - qu'il émet les bons outputs au clic sur les boutons
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { TeamCard } from './team-card';
import { Team } from '../team.model';

// Équipe fictive utilisée dans tous les tests
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

describe('TeamCard', () => {
  let component: TeamCard;
  let fixture: ComponentFixture<TeamCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeamCard],
    }).compileComponents();

    fixture = TestBed.createComponent(TeamCard);
    component = fixture.componentInstance;

    // setInput() est la méthode correcte pour initialiser un input()
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

  // ── Outputs ────────────────────────────────────────────────────────────────

  it('émet editClicked avec l\'équipe au clic sur "Modifier"', () => {
    // outputToObservable() convertit un output() Signal en Observable testable
    const emitted: Team[] = [];
    outputToObservable(component.editClicked).subscribe((t) => emitted.push(t));

    const btn = fixture.nativeElement.querySelector('.btn-action--edit') as HTMLButtonElement;
    btn.click();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual(mockTeam);
  });

  it('émet deleteClicked avec l\'équipe au clic sur "Supprimer"', () => {
    const emitted: Team[] = [];
    outputToObservable(component.deleteClicked).subscribe((t) => emitted.push(t));

    const btn = fixture.nativeElement.querySelector('.btn-action--delete') as HTMLButtonElement;
    btn.click();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual(mockTeam);
  });
});
