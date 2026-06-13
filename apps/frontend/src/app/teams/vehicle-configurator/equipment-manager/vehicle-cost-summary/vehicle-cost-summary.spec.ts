/**
 * Tests unitaires pour VehicleCostSummary.
 *
 * Composant "dumb" : on vérifie uniquement l'affichage des valeurs reçues en
 * input (mirroir de `team-budget.spec.ts`/`team-card.spec.ts`).
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VehicleCostSummary } from './vehicle-cost-summary';

describe('VehicleCostSummary', () => {
  let fixture: ComponentFixture<VehicleCostSummary>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VehicleCostSummary],
    }).compileComponents();

    fixture = TestBed.createComponent(VehicleCostSummary);

    fixture.componentRef.setInput('vehicleName', 'Camion');
    fixture.componentRef.setInput('emplacementsUtilises', 0);
    fixture.componentRef.setInput('emplacementsTotal', 4);
    fixture.componentRef.setInput('coutBase', 16);
    fixture.componentRef.setInput('coutEquipement', 0);
    fixture.componentRef.setInput('coutTotal', 16);
    fixture.detectChanges();
  });

  it('affiche le nom du véhicule (texte et title, pour la troncature)', () => {
    const el = fixture.nativeElement as HTMLElement;
    const name = el.querySelector('.vcs-name') as HTMLElement;

    expect(name.textContent?.trim()).toBe('Camion');
    expect(name.getAttribute('title')).toBe('Camion');
  });

  it('affiche les emplacements utilisés / totaux', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.vcs-slots')?.textContent).toContain('0 / 4');
  });

  it('affiche le détail du coût (base / équipement / total)', () => {
    const el = fixture.nativeElement as HTMLElement;
    const costRows = el.querySelectorAll('.vcs-cost-row');

    expect(costRows[0].textContent).toContain('Base');
    expect(costRows[0].textContent).toContain('16');
    expect(costRows[1].textContent).toContain('Équipement');
    expect(costRows[1].textContent).toContain('0');
    expect(costRows[2].textContent).toContain('Total');
    expect(costRows[2].textContent).toContain('16');
    expect(costRows[2].classList).toContain('vcs-cost-row--total');
  });

  it('met à jour le total quand le coût d\'équipement change', () => {
    fixture.componentRef.setInput('coutEquipement', 8);
    fixture.componentRef.setInput('coutTotal', 24);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const costRows = el.querySelectorAll('.vcs-cost-row');
    expect(costRows[1].textContent).toContain('8');
    expect(costRows[2].textContent).toContain('24');
  });
});
