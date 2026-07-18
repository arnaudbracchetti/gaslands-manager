/**
 * Tests unitaires pour VehicleCostSummary.
 *
 * Composant partiellement "dumb" : affichage des valeurs reçues en input
 * (mirroir de `team-budget.spec.ts`/`team-card.spec.ts`), plus le comportement
 * d'édition du nom (auto-save au blur, mirroir de `team-edit-page`).
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

    fixture.componentRef.setInput('customName', null);
    fixture.componentRef.setInput('typeNom', 'Camion');
    fixture.componentRef.setInput('emplacementsUtilises', 0);
    fixture.componentRef.setInput('emplacementsTotal', 4);
    fixture.componentRef.setInput('coutBase', 16);
    fixture.componentRef.setInput('coutEquipement', 0);
    fixture.componentRef.setInput('coutTotal', 16);
    fixture.detectChanges();
  });

  it('pré-remplit le champ avec typeNom quand customName est null', () => {
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector('.vcs-name') as HTMLInputElement;

    expect(input.value).toBe('Camion');
    expect(input.title).toBe('Camion');
  });

  it('pré-remplit le champ avec customName quand il est renseigné', async () => {
    fixture.componentRef.setInput('customName', 'La Teigne');
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector('.vcs-name') as HTMLInputElement;
    expect(input.value).toBe('La Teigne');
  });

  it('émet nameChanged (trimmé) au blur quand la valeur a changé', () => {
    const emitted: string[] = [];
    fixture.componentInstance.nameChanged.subscribe((v: string) => emitted.push(v));

    fixture.componentInstance.formNom.set('  La Teigne  ');
    fixture.componentInstance.onBlur();

    expect(emitted).toEqual(['La Teigne']);
  });

  it("n'émet rien au blur si la valeur est inchangée", () => {
    const emitted: string[] = [];
    fixture.componentInstance.nameChanged.subscribe((v: string) => emitted.push(v));

    fixture.componentInstance.onBlur();

    expect(emitted).toEqual([]);
  });

  it("n'émet rien au blur si la valeur est vide (revient à la valeur précédente)", () => {
    const emitted: string[] = [];
    fixture.componentInstance.nameChanged.subscribe((v: string) => emitted.push(v));

    fixture.componentInstance.formNom.set('   ');
    fixture.componentInstance.onBlur();

    expect(emitted).toEqual([]);
    expect(fixture.componentInstance.formNom()).toBe('Camion');
  });

  it('désactive le champ quand disabled=true', async () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector('.vcs-name') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it('affiche la section emplacements avec le label et un slot-gauge', () => {
    const el = fixture.nativeElement as HTMLElement;
    const slots = el.querySelector('.vcs-slots');
    expect(slots).not.toBeNull();
    expect(slots?.textContent).toContain('Emplacements');
    // les valeurs (0 / 4) sont rendues par SlotGauge, pas en texte brut
    expect(slots?.querySelector('app-slot-gauge')).not.toBeNull();
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
