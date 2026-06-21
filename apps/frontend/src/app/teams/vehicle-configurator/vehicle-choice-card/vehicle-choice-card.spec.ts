/**
 * Tests unitaires pour VehicleChoiceCard.
 *
 * Mirroir de `team-card.spec.ts` (cf. son en-tête) : composant "dumb", on
 * vérifie l'affichage des données reçues et l'émission de `chosen` au clic.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { VehicleChoiceCard } from './vehicle-choice-card';
import { Vehicule } from '../../../catalog/catalog.model';

const mockVehicule: Vehicule = {
  nom: 'Camion',
  nom_interne: 'camion',
  poids: 'Moyen',
  carrosserie: 12,
  manoeuvrabilite: 1,
  vitesse_max: 5,
  equipage: 2,
  emplacements: 4,
  prix: 16,
  description: 'Un poids lourd polyvalent.',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

describe('VehicleChoiceCard', () => {
  let component: VehicleChoiceCard;
  let fixture: ComponentFixture<VehicleChoiceCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VehicleChoiceCard],
    }).compileComponents();

    fixture = TestBed.createComponent(VehicleChoiceCard);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('vehicule', mockVehicule);
    fixture.detectChanges();
  });

  // ── Affichage ──────────────────────────────────────────────────────────────

  it('affiche le nom du véhicule', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.choice-card__name')?.textContent).toContain('Camion');
  });

  it('affiche la catégorie de poids', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.choice-card__weight')?.textContent).toContain('Moyen');
  });

  it('affiche la description', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.choice-card__description')?.textContent).toContain('Un poids lourd polyvalent.');
  });

  it('affiche les statistiques (carrosserie, manœuvrabilité, vitesse, équipage, emplacements)', () => {
    const el = fixture.nativeElement as HTMLElement;
    const stats = Array.from(el.querySelectorAll('.stat')).map((s) => s.textContent ?? '');

    expect(stats.some((s) => s.includes('12'))).toBe(true); // carrosserie
    expect(stats.some((s) => s.includes('1'))).toBe(true);  // manoeuvrabilité
    expect(stats.some((s) => s.includes('5'))).toBe(true);  // vitesse_max
    expect(stats.some((s) => s.includes('2'))).toBe(true);  // equipage
    // emplacements (4) affichés via SlotGauge, pas en texte brut dans .stat
  });

  it('affiche le prix en jerricans', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.choice-card__price')?.textContent).toContain('16');
  });

  // ── Output ─────────────────────────────────────────────────────────────────

  it('émet chosen avec le véhicule au clic sur "Choisir ce véhicule"', () => {
    const emitted: Vehicule[] = [];
    outputToObservable(component.chosen).subscribe((v) => emitted.push(v));

    const btn = fixture.nativeElement.querySelector('.choice-card__choose') as HTMLButtonElement;
    btn.click();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual(mockVehicule);
  });
});
