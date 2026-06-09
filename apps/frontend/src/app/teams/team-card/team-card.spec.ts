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
import { TeamVehiclePair, VehicleSummary } from '../vehicle-summary';

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

// Résumés de véhicules fictifs — la forme déjà réduite que `Teams` calcule via
// `buildVehicleSummary` et transmet telle quelle (TeamCard ne fait AUCUN calcul,
// cf. doc de l'input `vehicles` : "affiche ce qu'on lui donne").
const mockVehicleSummaries: VehicleSummary[] = [
  { id: 1, nom: 'Camion', cout: 21 },
  { id: 2, nom: 'Monster Truck', cout: 28 },
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

  // ── Liste des véhicules ────────────────────────────────────────────────────
  // `vehicles` a une valeur par défaut `[]` (cf. son input() — pas de
  // `setInput` nécessaire pour le cas "vide").

  it('n\'affiche pas la liste des véhicules par défaut (input vide)', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.team-card__vehicles')).toBeNull();
  });

  it('affiche le nom et le coût de chaque véhicule reçu', () => {
    fixture.componentRef.setInput('vehicles', mockVehicleSummaries);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.team-card__vehicle');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('Camion');
    expect(items[0].textContent).toContain('21');
    expect(items[1].textContent).toContain('Monster Truck');
    expect(items[1].textContent).toContain('28');
  });

  it('affiche le coût exact (toujours number, jamais de préfixe "≈" — Tourelle résolue côté backend)', () => {
    fixture.componentRef.setInput('vehicles', mockVehicleSummaries);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.team-card__vehicle-cost');
    // Les deux coûts sont exacts — aucun "≈" attendu
    expect(items[0].textContent?.trim().startsWith('≈')).toBe(false);
    expect(items[1].textContent?.trim().startsWith('≈')).toBe(false);
    expect(items[0].textContent).toContain('21');
    expect(items[1].textContent).toContain('28');
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

  it('émet addVehicleClicked avec l\'équipe au clic sur "Ajouter un véhicule"', () => {
    const emitted: Team[] = [];
    outputToObservable(component.addVehicleClicked).subscribe((t) => emitted.push(t));

    const btn = fixture.nativeElement.querySelector('.btn-add-vehicle') as HTMLButtonElement;
    btn.click();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual(mockTeam);
  });

  // ── Outputs par véhicule ───────────────────────────────────────────────────
  // Émettent une `TeamVehiclePair` (équipe courante + véhicule visé) — cf. doc
  // de `editVehicleClicked`/`deleteVehicleClicked` : `TeamCard` est seule à
  // connaître les deux moitiés de la paire au moment du clic.

  it('émet editVehicleClicked avec la paire {équipe, véhicule} au clic sur "Modifier" un véhicule', () => {
    fixture.componentRef.setInput('vehicles', mockVehicleSummaries);
    fixture.detectChanges();

    const emitted: TeamVehiclePair[] = [];
    outputToObservable(component.editVehicleClicked).subscribe((p) => emitted.push(p));

    const btn = fixture.nativeElement.querySelectorAll('.btn-vehicle-action--edit')[0] as HTMLButtonElement;
    btn.click();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual({ team: mockTeam, vehicle: mockVehicleSummaries[0] });
  });

  it('émet deleteVehicleClicked avec la paire {équipe, véhicule} au clic sur "Supprimer" un véhicule', () => {
    fixture.componentRef.setInput('vehicles', mockVehicleSummaries);
    fixture.detectChanges();

    const emitted: TeamVehiclePair[] = [];
    outputToObservable(component.deleteVehicleClicked).subscribe((p) => emitted.push(p));

    // Deuxième véhicule de la liste — vérifie qu'on émet bien CELUI cliqué, pas
    // systématiquement le premier (cf. assemblage par ligne dans le `@for`).
    const btn = fixture.nativeElement.querySelectorAll('.btn-vehicle-action--delete')[1] as HTMLButtonElement;
    btn.click();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual({ team: mockTeam, vehicle: mockVehicleSummaries[1] });
  });
});
