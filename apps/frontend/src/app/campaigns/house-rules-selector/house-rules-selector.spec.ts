import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { HouseRulesSelector, HouseRuleToggledEvent } from './house-rules-selector';
import type { HouseRuleDefinition } from '../campaign.model';

const mockDefinitions: HouseRuleDefinition[] = [
  {
    nom: 'Aucun point de championnat',
    nom_interne: 'resistance_sans_points_championnat',
    description_decochee: '<p>Comportement par défaut : seconde moitié du classement.</p>',
    description_cochee: '<p>Comportement alternatif : aucun point de championnat.</p>',
  },
  {
    nom: 'Une autre règle',
    nom_interne: 'une_autre_regle',
    description_decochee: '<p>Décoché : défaut.</p>',
    description_cochee: '<p>Coché : alternatif.</p>',
  },
];

describe('HouseRulesSelector', () => {
  let fixture: ComponentFixture<HouseRulesSelector>;
  let component: HouseRulesSelector;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HouseRulesSelector],
    }).compileComponents();
    fixture = TestBed.createComponent(HouseRulesSelector);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('definitions', mockDefinitions);
    fixture.detectChanges();
  });

  it('affiche une case à cocher par règle du catalogue', () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes).toHaveLength(2);
  });

  it('coche uniquement les règles listées dans enabledKeys', () => {
    fixture.componentRef.setInput('enabledKeys', ['une_autre_regle']);
    fixture.detectChanges();

    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes[0].checked).toBe(false);
    expect(checkboxes[1].checked).toBe(true);
  });

  it('affiche la ligne "décochée" quand la règle est désactivée', () => {
    const description = fixture.nativeElement.querySelector('.hrs__rule-description');
    expect(description.textContent).toContain('Comportement par défaut');
  });

  it('affiche la ligne "cochée" dès que la règle est activée', () => {
    fixture.componentRef.setInput('enabledKeys', ['resistance_sans_points_championnat']);
    fixture.detectChanges();

    const description = fixture.nativeElement.querySelector('.hrs__rule-description');
    expect(description.textContent).toContain('Comportement alternatif');
  });

  it('émet toggled avec la clé et le nouvel état au clic', () => {
    const emitted: HouseRuleToggledEvent[] = [];
    outputToObservable(component.toggled).subscribe((e) => emitted.push(e));

    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].click();
    fixture.detectChanges();

    expect(emitted).toEqual([{ nomInterne: 'resistance_sans_points_championnat', enabled: true }]);
  });

  it('émet toggled avec enabled: false quand la règle était déjà cochée', () => {
    fixture.componentRef.setInput('enabledKeys', ['resistance_sans_points_championnat']);
    fixture.detectChanges();

    const emitted: HouseRuleToggledEvent[] = [];
    outputToObservable(component.toggled).subscribe((e) => emitted.push(e));

    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].click();
    fixture.detectChanges();

    expect(emitted).toEqual([{ nomInterne: 'resistance_sans_points_championnat', enabled: false }]);
  });

  it('désactive les cases et n\'émet rien quand locked est vrai', () => {
    fixture.componentRef.setInput('locked', true);
    fixture.detectChanges();

    const emitted: HouseRuleToggledEvent[] = [];
    outputToObservable(component.toggled).subscribe((e) => emitted.push(e));

    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((cb: HTMLInputElement) => expect(cb.disabled).toBe(true));

    component.onToggle(mockDefinitions[0], true);

    expect(emitted).toHaveLength(0);
  });

  it('affiche un message quand le catalogue est vide', () => {
    fixture.componentRef.setInput('definitions', []);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.hrs__hint')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
  });
});
