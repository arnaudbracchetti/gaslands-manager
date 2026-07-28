/**
 * Tests unitaires pour SequellaDetailModal.
 *
 * Mirroir de `equipment-detail-modal.spec.ts` (cf. son en-tête) : composant "dumb",
 * purement informatif — on vérifie l'affichage complet (nom, coût en Chocs,
 * description, règles, raison d'indisponibilité éventuelle) et la seule sortie
 * `closed` (Annuler / clic sur l'overlay).
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { SequellaDetailModal } from './sequella-detail-modal';
import { AvailableSequellaDto } from '../../../../campaigns/workshop.model';

const availableSequella: AvailableSequellaDto = {
  nom: 'Suicidaire',
  nomInterne: 'suicidaire',
  chocsCost: 1,
  description: 'Ce pilote fonce sans jamais lever le pied.',
  regles: 'Ce véhicule ne peut pas rétrograder volontairement.',
  disponible: true,
};

const unavailableSequella: AvailableSequellaDto = {
  nom: 'Suicidaire',
  nomInterne: 'suicidaire',
  chocsCost: 1,
  description: 'Ce pilote fonce sans jamais lever le pied.',
  regles: 'Ce véhicule ne peut pas rétrograder volontairement.',
  disponible: false,
  raison: 'Chocs insuffisants',
};

describe('SequellaDetailModal', () => {
  let component: SequellaDetailModal;
  let fixture: ComponentFixture<SequellaDetailModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SequellaDetailModal],
    }).compileComponents();

    fixture = TestBed.createComponent(SequellaDetailModal);
    component = fixture.componentInstance;
  });

  function setUp(sequella: AvailableSequellaDto): void {
    fixture.componentRef.setInput('sequella', sequella);
    fixture.detectChanges();
  }

  it('affiche le nom, le coût en Chocs, la description et les règles', () => {
    setUp(availableSequella);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.sdm-modal__name')?.textContent).toContain('Suicidaire');
    expect(el.querySelector('.sdm-modal__badge')?.textContent).toContain('1');
    expect(el.querySelector('.sdm-modal__description')?.textContent).toContain(
      'Ce pilote fonce sans jamais lever le pied.',
    );
    expect(el.querySelector('.sdm-modal__regles')?.textContent).toContain(
      'Ce véhicule ne peut pas rétrograder volontairement.',
    );
  });

  it('affiche la raison quand la séquelle est indisponible', () => {
    setUp(unavailableSequella);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.sdm-modal__reason')?.textContent).toContain('Chocs insuffisants');
  });

  it('n\'affiche pas de raison quand la séquelle est disponible', () => {
    setUp(availableSequella);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.sdm-modal__reason')).toBeNull();
  });

  it('émet `closed` au clic sur "Annuler"', () => {
    setUp(availableSequella);

    let emittedCount = 0;
    outputToObservable(component.closed).subscribe(() => emittedCount++);

    (fixture.nativeElement.querySelector('.ms-modal__cancel') as HTMLButtonElement).click();

    expect(emittedCount).toBe(1);
  });

  it('émet `closed` au clic sur l\'overlay (en dehors de la boîte)', () => {
    setUp(availableSequella);

    let emittedCount = 0;
    outputToObservable(component.closed).subscribe(() => emittedCount++);

    (fixture.nativeElement.querySelector('.ms-overlay') as HTMLElement)
      .dispatchEvent(new Event('click', { bubbles: true }));

    expect(emittedCount).toBe(1);
  });

  it('n\'émet PAS `closed` au clic à l\'intérieur de la boîte', () => {
    setUp(availableSequella);

    let emittedCount = 0;
    outputToObservable(component.closed).subscribe(() => emittedCount++);

    (fixture.nativeElement.querySelector('.ms-modal') as HTMLElement)
      .dispatchEvent(new Event('click', { bubbles: true }));

    expect(emittedCount).toBe(0);
  });
});
