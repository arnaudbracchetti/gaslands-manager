/**
 * Tests unitaires pour TeamForm.
 *
 * TeamForm est un composant "dumb" : on vérifie
 * - l'adaptation du titre selon le mode (création / édition)
 * - le pré-remplissage des champs via l'input `team`
 * - l'émission du bon DTO lors de la sauvegarde
 * - la validation locale (nom obligatoire)
 * - l'émission de cancel au clic sur Annuler
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { TeamForm } from './team-form';
import { Team, CreateTeamDto } from '../team.model';

const mockTeam: Team = {
  id: 1,
  name: 'Les Furieux du Désert',
  sponsor: 'Miyazaki',
  cans: 60,
  description: 'Une description',
  userId: 42,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

describe('TeamForm', () => {
  let component: TeamForm;
  let fixture: ComponentFixture<TeamForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeamForm],
    }).compileComponents();

    fixture = TestBed.createComponent(TeamForm);
    component = fixture.componentInstance;
    // Par défaut : mode création (team = null)
    fixture.detectChanges();
  });

  // ── Titre ──────────────────────────────────────────────────────────────────

  it('affiche "Nouvelle équipe" en mode création (team = null)', () => {
    expect(component.formTitle()).toContain('Nouvelle équipe');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent).toContain('Nouvelle équipe');
  });

  it('affiche "Modifier l\'équipe" en mode édition (team fourni)', () => {
    fixture.componentRef.setInput('team', mockTeam);
    fixture.detectChanges();

    expect(component.formTitle()).toContain('Modifier');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent).toContain('Modifier');
  });

  // ── Pré-remplissage ────────────────────────────────────────────────────────

  it('pré-remplit les champs quand un team est passé en input', () => {
    fixture.componentRef.setInput('team', mockTeam);
    fixture.detectChanges();

    // L'effect() doit avoir mis à jour les signals internes
    expect(component.formName()).toBe('Les Furieux du Désert');
    expect(component.formSponsor()).toBe('Miyazaki');
    expect(component.formCans()).toBe(60);
    expect(component.formDescription()).toBe('Une description');
  });

  it('remet les champs par défaut quand team repasse à null', () => {
    fixture.componentRef.setInput('team', mockTeam);
    fixture.detectChanges();

    fixture.componentRef.setInput('team', null);
    fixture.detectChanges();

    expect(component.formName()).toBe('');
    expect(component.formSponsor()).toBe('Rutherford');
    expect(component.formCans()).toBe(50); // DEFAULT_CANS
  });

  // ── Sauvegarde ─────────────────────────────────────────────────────────────

  it('émet saved avec le DTO correct quand le formulaire est valide', () => {
    const emitted: CreateTeamDto[] = [];
    outputToObservable(component.saved).subscribe((dto) => emitted.push(dto));

    component.formName.set('Nouvelle Équipe');
    component.formSponsor.set('Idris');
    component.formCans.set(45);
    component.formDescription.set('Ma description');

    component.saveForm();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual({
      name: 'Nouvelle Équipe',
      sponsor: 'Idris',
      cans: 45,
      description: 'Ma description',
    });
  });

  it('n\'émet pas saved et affiche une erreur si le nom est vide', () => {
    const emitted: CreateTeamDto[] = [];
    outputToObservable(component.saved).subscribe((dto) => emitted.push(dto));

    component.formName.set('   '); // que des espaces
    component.saveForm();

    expect(emitted).toHaveLength(0);
    expect(component.formError()).toContain('obligatoire');
  });

  it('omet la description du DTO si elle est vide', () => {
    const emitted: CreateTeamDto[] = [];
    outputToObservable(component.saved).subscribe((dto) => emitted.push(dto));

    component.formName.set('Mon équipe');
    component.formDescription.set('   '); // espaces → doit être omis

    component.saveForm();

    expect(emitted[0].description).toBeUndefined();
  });

  // ── Annulation ─────────────────────────────────────────────────────────────

  it('émet cancel au clic sur "Annuler"', () => {
    let cancelled = false;
    outputToObservable(component.cancel).subscribe(() => (cancelled = true));

    const btn = fixture.nativeElement.querySelector('.btn-secondary') as HTMLButtonElement;
    btn.click();

    expect(cancelled).toBe(true);
  });
});
