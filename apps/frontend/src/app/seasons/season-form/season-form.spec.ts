/**
 * Tests unitaires pour SeasonForm.
 *
 * Composant "dumb" : on vérifie
 * - la validation locale (nom obligatoire)
 * - l'émission du bon DTO lors de la sauvegarde
 * - l'émission de formCancel au clic sur Annuler
 * - le comportement CA3 : aucune équipe disponible → message + soumission désactivée
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { SeasonForm } from './season-form';
import { Team } from '../../teams/team.model';
import { CreateSeasonDto } from '../season.model';

const mockTeams: Team[] = [
  {
    id: 7,
    name: 'Les Furieux du Désert',
    sponsor: 'Rutherford',
    cans: 50,
    userId: 42,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 8,
    name: 'Brigade de l\'Asphalte',
    sponsor: 'Miyazaki',
    cans: 60,
    userId: 42,
    createdAt: '2025-01-02T00:00:00.000Z',
    updatedAt: '2025-01-02T00:00:00.000Z',
  },
];

describe('SeasonForm', () => {
  let component: SeasonForm;
  let fixture: ComponentFixture<SeasonForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeasonForm],
    }).compileComponents();

    fixture = TestBed.createComponent(SeasonForm);
    component = fixture.componentInstance;
  });

  // ── CA3 : aucune équipe disponible ──────────────────────────────────────────

  it('affiche un message et masque le bouton Enregistrer si l\'utilisateur n\'a aucune équipe', () => {
    fixture.componentRef.setInput('teams', []);
    fixture.detectChanges();

    expect(component.noTeams()).toBe(true);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.form-info')?.textContent).toContain('créer une équipe');
    expect(el.querySelector('.btn-primary')).toBeNull();
  });

  // ── Pré-sélection ─────────────────────────────────────────────────────────

  it('pré-sélectionne la première équipe quand teams est fourni', () => {
    fixture.componentRef.setInput('teams', mockTeams);
    fixture.detectChanges();

    expect(component.formTeamId()).toBe(7);
  });

  // ── Validation ────────────────────────────────────────────────────────────

  it('refuse la sauvegarde si le nom est vide', () => {
    fixture.componentRef.setInput('teams', mockTeams);
    fixture.detectChanges();

    const emitted: CreateSeasonDto[] = [];
    outputToObservable(component.saved).subscribe((dto) => emitted.push(dto));

    component.formName.set('   ');
    component.saveForm();

    expect(emitted).toHaveLength(0);
    expect(component.formError()).toContain('obligatoire');
  });

  // ── Émission du DTO ──────────────────────────────────────────────────────

  it('émet le DTO validé avec le nom et l\'équipe choisie', () => {
    fixture.componentRef.setInput('teams', mockTeams);
    fixture.detectChanges();

    const emitted: CreateSeasonDto[] = [];
    outputToObservable(component.saved).subscribe((dto) => emitted.push(dto));

    component.formName.set('Coupe Verney');
    component.formTeamId.set(8);
    component.saveForm();

    expect(emitted).toEqual([{ name: 'Coupe Verney', teamId: 8 }]);
  });

  // ── Annulation ────────────────────────────────────────────────────────────

  it('émet formCancel au clic sur Annuler', () => {
    fixture.componentRef.setInput('teams', mockTeams);
    fixture.detectChanges();

    let cancelled = false;
    outputToObservable(component.formCancel).subscribe(() => { cancelled = true; });

    component.cancelForm();

    expect(cancelled).toBe(true);
  });
});
