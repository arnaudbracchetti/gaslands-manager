/**
 * Tests unitaires pour SequellaAdvantagePicker.
 *
 * Mirroir de `equipment-option.spec.ts` (cf. son en-tête) côté approche : composant
 * "dumb", on vérifie l'affichage de la liste reçue ET le flux d'émission —
 * en particulier qu'aucune confirmation ne peut être émise sans sélection (le
 * backend exige un choix explicite pour "Dur à Cuire", cf. `Vehicle.assertCanAddSequella`).
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { SequellaAdvantagePicker } from './sequella-advantage-picker';
import type { Avantage } from '../../../../catalog/catalog.model';

const advantages: Avantage[] = [
  {
    nom: 'Baril de Poudre', nom_interne: 'baril_de_poudre', categorie: 'Dur à Cuire',
    prix: 1, description: '<p>Explosion plus dangereuse.</p>', regles: '',
  },
  {
    nom: 'Sens du Spectacle', nom_interne: 'sens_du_spectacle', categorie: 'Dur à Cuire',
    prix: 1, description: '<p>Transforme une Perte de Contrôle en Vote du Public.</p>', regles: '',
  },
];

describe('SequellaAdvantagePicker', () => {
  let component: SequellaAdvantagePicker;
  let fixture: ComponentFixture<SequellaAdvantagePicker>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SequellaAdvantagePicker],
    }).compileComponents();

    fixture = TestBed.createComponent(SequellaAdvantagePicker);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('advantages', advantages);
    fixture.detectChanges();
  });

  it('affiche un item par avantage reçu, avec nom et description', () => {
    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.sap-item');

    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('Baril de Poudre');
    expect(items[0].textContent).toContain('Explosion plus dangereuse.');
    expect(items[1].textContent).toContain('Sens du Spectacle');
  });

  it('désactive "Valider" tant qu\'aucun avantage n\'est sélectionné', () => {
    const el = fixture.nativeElement as HTMLElement;
    const confirmBtn = el.querySelector('.ms-modal__confirm') as HTMLButtonElement;

    expect(confirmBtn.disabled).toBe(true);
  });

  it('sélectionne un avantage au clic sur son radio et active "Valider"', () => {
    const el = fixture.nativeElement as HTMLElement;
    const radios = el.querySelectorAll<HTMLInputElement>('.sap-item__radio');

    radios[1].dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(component.selectedNomInterne()).toBe('sens_du_spectacle');
    const confirmBtn = el.querySelector('.ms-modal__confirm') as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(false);
  });

  it('émet confirmed avec le nom_interne choisi au clic sur "Valider"', () => {
    const emitted: string[] = [];
    outputToObservable(component.confirmed).subscribe((n) => emitted.push(n));

    component.select('baril_de_poudre');
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.ms-modal__confirm') as HTMLButtonElement).click();

    expect(emitted).toEqual(['baril_de_poudre']);
  });

  it('n\'émet jamais confirmed sans sélection, même si le bouton est cliqué par programme', () => {
    const emitted: string[] = [];
    outputToObservable(component.confirmed).subscribe((n) => emitted.push(n));

    component.onConfirm();

    expect(emitted).toHaveLength(0);
  });

  it('émet cancelled au clic sur "Annuler"', () => {
    const emitted: void[] = [];
    outputToObservable(component.cancelled).subscribe(() => emitted.push(undefined));

    (fixture.nativeElement.querySelector('.ms-modal__cancel') as HTMLButtonElement).click();

    expect(emitted).toHaveLength(1);
  });
});
