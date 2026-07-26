/**
 * Tests unitaires pour VehicleSummaryCard.
 *
 * Mirroir de `team-card.spec.ts` (cf. son en-tête) : composant "dumb", toute la
 * carte est cliquable (`cardClicked`) — seul le bouton supprimer/vendre doit
 * rester une action séparée, protégée par `stopPropagation` (clic ET clavier,
 * cf. en-tête de `vehicle-summary-card.ts`).
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { VehicleSummaryCard } from './vehicle-summary-card';
import { VehicleSummary } from '../vehicle-summary';

const mockVehicle: VehicleSummary = {
  id: 7,
  nom: 'Camion',
  customName: null,
  typeNom: 'Camion',
  cout: 21,
  emplacementsUtilises: 2,
  emplacementsTotal: 3,
  equipements: ['Mitrailleuse'],
};

describe('VehicleSummaryCard', () => {
  let component: VehicleSummaryCard;
  let fixture: ComponentFixture<VehicleSummaryCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VehicleSummaryCard],
    }).compileComponents();

    fixture = TestBed.createComponent(VehicleSummaryCard);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('vehicle', mockVehicle);
    fixture.detectChanges();
  });

  // ── Output cardClicked : toute la carte est cliquable ───────────────────────

  it('émet cardClicked avec l\'id du véhicule au clic sur la carte', () => {
    const emitted: number[] = [];
    outputToObservable(component.cardClicked).subscribe((id) => emitted.push(id));

    const card = fixture.nativeElement.querySelector('.tep-vehicle-card') as HTMLElement;
    card.click();

    expect(emitted).toEqual([7]);
  });

  it('émet cardClicked au clavier (Entrée) sur la carte focalisée', () => {
    const emitted: number[] = [];
    outputToObservable(component.cardClicked).subscribe((id) => emitted.push(id));

    const card = fixture.nativeElement.querySelector('.tep-vehicle-card') as HTMLElement;
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(emitted).toEqual([7]);
  });

  it('émet cardClicked au clavier (Espace) sur la carte focalisée', () => {
    const emitted: number[] = [];
    outputToObservable(component.cardClicked).subscribe((id) => emitted.push(id));

    const card = fixture.nativeElement.querySelector('.tep-vehicle-card') as HTMLElement;
    card.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

    expect(emitted).toEqual([7]);
  });

  it('porte role="button" et tabindex="0" pour l\'accessibilité clavier', () => {
    const card = fixture.nativeElement.querySelector('.tep-vehicle-card') as HTMLElement;

    expect(card.getAttribute('role')).toBe('button');
    expect(card.getAttribute('tabindex')).toBe('0');
  });

  // ── Bouton supprimer/vendre : action séparée, protégée par stopPropagation ──

  it('émet deleteClicked au clic sur le bouton supprimer, et n\'émet PAS cardClicked', () => {
    const deleted: VehicleSummary[] = [];
    const carded: number[] = [];
    outputToObservable(component.deleteClicked).subscribe((v) => deleted.push(v));
    outputToObservable(component.cardClicked).subscribe((id) => carded.push(id));

    const deleteBtn = fixture.nativeElement.querySelector('.tep-btn-delete-vehicle') as HTMLButtonElement;
    deleteBtn.click();

    expect(deleted).toEqual([mockVehicle]);
    expect(carded).toHaveLength(0);
  });

  it('n\'émet PAS cardClicked au clavier (Entrée) sur le bouton supprimer focalisé', () => {
    const carded: number[] = [];
    outputToObservable(component.cardClicked).subscribe((id) => carded.push(id));

    const deleteBtn = fixture.nativeElement.querySelector('.tep-btn-delete-vehicle') as HTMLButtonElement;
    deleteBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(carded).toHaveLength(0);
  });

  it('ne montre ni le bouton supprimer ni la rangée d\'actions quand showDelete est faux', () => {
    fixture.componentRef.setInput('showDelete', false);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.tep-btn-delete-vehicle')).toBeNull();
    expect(el.querySelector('.tep-vehicle-card__actions')).toBeNull();
  });

  // ── État sélectionné (vue lecture seule maître-détail) ──────────────────────

  it('applique la classe --selected quand `selected` est vrai', () => {
    fixture.componentRef.setInput('selected', true);
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.tep-vehicle-card') as HTMLElement;
    expect(card.classList.contains('tep-vehicle-card--selected')).toBe(true);
  });

  it('n\'applique pas la classe --selected par défaut', () => {
    const card = fixture.nativeElement.querySelector('.tep-vehicle-card') as HTMLElement;
    expect(card.classList.contains('tep-vehicle-card--selected')).toBe(false);
  });
});
