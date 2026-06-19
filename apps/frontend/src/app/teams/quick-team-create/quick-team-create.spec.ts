/**
 * Tests unitaires pour QuickTeamCreate.
 *
 * Composant "dumb" : on vérifie
 * - l'affichage initial (bouton "+ Créer une nouvelle équipe")
 * - le passage en mode saisie au clic
 * - la validation locale (nom obligatoire)
 * - l'émission du DTO avec sponsor/budget par défaut
 * - l'annulation
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { QuickTeamCreate } from './quick-team-create';
import { CreateTeamDto, DEFAULT_CANS, SPONSORS } from '../team.model';

describe('QuickTeamCreate', () => {
  let component: QuickTeamCreate;
  let fixture: ComponentFixture<QuickTeamCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuickTeamCreate],
    }).compileComponents();

    fixture = TestBed.createComponent(QuickTeamCreate);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('affiche le bouton "+ Créer une nouvelle équipe" en mode replié', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.btn-link')?.textContent).toContain('Créer une nouvelle équipe');
    expect(el.querySelector('input')).toBeNull();
  });

  it('révèle le champ de saisie au clic sur le bouton', () => {
    component.expand();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('input')).not.toBeNull();
  });

  it('refuse la création si le nom est vide', () => {
    component.expand();
    fixture.detectChanges();

    const emitted: CreateTeamDto[] = [];
    outputToObservable(component.created).subscribe((dto) => emitted.push(dto));

    component.name.set('   ');
    component.confirm();

    expect(emitted).toHaveLength(0);
    expect(component.error()).toContain('obligatoire');
  });

  it('émet le DTO avec sponsor et budget par défaut', () => {
    component.expand();
    fixture.detectChanges();

    const emitted: CreateTeamDto[] = [];
    outputToObservable(component.created).subscribe((dto) => emitted.push(dto));

    component.name.set('Équipe du Vendredi');
    component.confirm();

    expect(emitted).toEqual([{ name: 'Équipe du Vendredi', sponsor: SPONSORS[0], cans: DEFAULT_CANS }]);
    expect(component.expanded()).toBe(false);
  });

  it('annule la saisie et masque le champ', () => {
    component.expand();
    component.name.set('Test');
    fixture.detectChanges();

    component.cancel();
    fixture.detectChanges();

    expect(component.expanded()).toBe(false);
    expect(component.name()).toBe('');
  });
});
