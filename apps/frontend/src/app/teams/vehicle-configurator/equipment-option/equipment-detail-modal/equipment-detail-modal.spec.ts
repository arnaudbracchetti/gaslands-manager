/**
 * Tests unitaires pour EquipmentDetailModal.
 *
 * Mirroir de `equipment-option.spec.ts` (cf. son en-tête) : composant "dumb",
 * purement informatif — on vérifie l'affichage complet (nom, coût, emplacement,
 * description, règles, raison d'indisponibilité éventuelle) et la seule sortie
 * `closed` (Annuler / clic sur l'overlay).
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { EquipmentDetailModal } from './equipment-detail-modal';
import { EquipmentOption as EquipmentOptionDto } from '../../vehicle-builder.model';

const availableOption: EquipmentOptionDto = {
  nom: 'Mitrailleuse',
  nomInterne: 'mitrailleuse',
  prix: 4,
  emplacement: 1,
  description: 'Arme de base à Portée Moyenne lançant 1D6.',
  regles: 'Portée Moyenne. Lance 1D6 par tir.',
  disponible: true,
};

const unavailableOption: EquipmentOptionDto = {
  nom: 'BFG',
  nomInterne: 'bfg',
  prix: 18,
  emplacement: 2,
  description: 'Arme lourde dévastatrice à courte portée.',
  regles: 'Portée Courte. Lance 5D6 par tir.',
  disponible: false,
  raison: 'Emplacements insuffisants : 6/5 requis avec "BFG"',
};

const orientableOption: EquipmentOptionDto = {
  nom: 'Mitrailleuse',
  nomInterne: 'mitrailleuse',
  prix: 4,
  emplacement: 1,
  description: 'Arme de base à Portée Moyenne lançant 1D6.',
  regles: 'Portée Moyenne. Lance 1D6 par tir.',
  disponible: false,
  raison: 'Une orientation est requise pour monter "Mitrailleuse" sur un arc de tir',
};

describe('EquipmentDetailModal', () => {
  let component: EquipmentDetailModal;
  let fixture: ComponentFixture<EquipmentDetailModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EquipmentDetailModal],
    }).compileComponents();

    fixture = TestBed.createComponent(EquipmentDetailModal);
    component = fixture.componentInstance;
  });

  function setUp(option: EquipmentOptionDto, requiresOrientation = false): void {
    fixture.componentRef.setInput('option', option);
    fixture.componentRef.setInput('requiresOrientation', requiresOrientation);
    fixture.detectChanges();
  }

  it('affiche le nom, le coût, l\'emplacement, la description et les règles', () => {
    setUp(availableOption);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.edm-modal__name')?.textContent).toContain('Mitrailleuse');
    expect(el.textContent).toContain('4');
    expect(el.textContent).toContain('1');
    expect(el.querySelector('.edm-modal__description')?.textContent).toContain(
      'Arme de base à Portée Moyenne lançant 1D6.',
    );
    expect(el.querySelector('.edm-modal__regles')?.textContent).toContain(
      'Portée Moyenne. Lance 1D6 par tir.',
    );
  });

  it('affiche la raison pour un refus définitif', () => {
    setUp(unavailableOption);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.edm-modal__reason')?.textContent).toContain('Emplacements insuffisants');
  });

  it('ne montre pas de raison quand une orientation est requise', () => {
    setUp(orientableOption, true);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.edm-modal__reason')).toBeNull();
  });

  it('émet `closed` au clic sur "Annuler"', () => {
    setUp(availableOption);

    let emittedCount = 0;
    outputToObservable(component.closed).subscribe(() => emittedCount++);

    (fixture.nativeElement.querySelector('.edm-modal__cancel') as HTMLButtonElement).click();

    expect(emittedCount).toBe(1);
  });

  it('émet `closed` au clic sur l\'overlay (en dehors de la boîte)', () => {
    setUp(availableOption);

    let emittedCount = 0;
    outputToObservable(component.closed).subscribe(() => emittedCount++);

    (fixture.nativeElement.querySelector('.edm-overlay') as HTMLElement)
      .dispatchEvent(new Event('click', { bubbles: true }));

    expect(emittedCount).toBe(1);
  });

  it('n\'émet PAS `closed` au clic à l\'intérieur de la boîte', () => {
    setUp(availableOption);

    let emittedCount = 0;
    outputToObservable(component.closed).subscribe(() => emittedCount++);

    (fixture.nativeElement.querySelector('.edm-modal') as HTMLElement)
      .dispatchEvent(new Event('click', { bubbles: true }));

    expect(emittedCount).toBe(0);
  });
});
