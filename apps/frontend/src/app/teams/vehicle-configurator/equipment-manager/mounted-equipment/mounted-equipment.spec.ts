/**
 * Tests unitaires pour MountedEquipment.
 *
 * Composant "dumb" : on vérifie l'affichage des listes "Armes"/"Améliorations"
 * (y compris la résolution des noms/emplacements depuis `sponsorCatalog` et
 * toute la logique d'affichage Tourelle — assignée, orpheline, intégrée), et
 * l'émission des 4 outputs au clic sur chaque bouton d'action (mirroir de
 * `team-card.spec.ts` pour `outputToObservable`).
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { MountedEquipment } from './mounted-equipment';
import { Sponsor } from '../../../../catalog/catalog.model';
import { VehicleImprovement, Weapon } from '../../vehicle-builder.model';

// Catalogue minimal — sert à résoudre noms/emplacements affichés.
const mockSponsorCatalog: Sponsor = {
  nom: 'Rutherford',
  description: 'Sponsor militaire.',
  classes_avantage: ['Militaire'],
  avantages_sponsorises: '',
  vehicules: [],
  armes: [
    { nom: 'Mitrailleuse', nom_interne: 'mitrailleuse', type: 'base', prix: 4, emplacement: 1, description: '', regles: '', sponsors_autorises: ['Rutherford'] },
    { nom: 'BFG', nom_interne: 'bfg', type: 'avancée', prix: 18, emplacement: 2, description: '', regles: '', sponsors_autorises: ['Rutherford'] },
  ],
  ameliorations: [
    { nom: 'Blindage', nom_interne: 'blindage', prix: 4, emplacement: 1, description: '', regles: '', sponsors_autorises: ['Rutherford'] },
    { nom: 'Tourelle', nom_interne: 'tourelle', prix: 'x3', emplacement: 0, description: '', regles: '', sponsors_autorises: ['Rutherford'] },
  ],
};

const mockWeapon: Weapon = {
  id: 200,
  nomInterne: 'mitrailleuse',
  orientation: 'avant',
  vehicleId: 100,
  createdAt: '2026-01-01T00:00:01.000Z',
  prix: 4,
};

const mockImprovement: VehicleImprovement = {
  id: 300,
  nomInterne: 'blindage',
  orientation: null,
  vehicleId: 100,
  createdAt: '2026-01-01T00:00:02.000Z',
  estDefaut: false,
  prix: 4,
  emplacement: 1,
  weaponNomInterne: null,
};

// Tourelle assignée — ligne fusionnée "Arme (Tourelle)".
const mockTourelleAssignee: VehicleImprovement = {
  id: 301,
  nomInterne: 'tourelle',
  orientation: 'avant',
  vehicleId: 100,
  createdAt: '2026-01-01T00:00:03.000Z',
  estDefaut: false,
  prix: 54, // 3 × 18 (BFG)
  emplacement: 0,
  weaponNomInterne: 'bfg',
};

// Tourelle orpheline — aucune arme assignée.
const mockTourelleOrpheline: VehicleImprovement = {
  ...mockTourelleAssignee,
  id: 302,
  orientation: null,
  prix: 0,
  weaponNomInterne: null,
};

// Tourelle intégrée (Char d'assaut, estDefaut) — non supprimable.
const mockTourelleIntegree: VehicleImprovement = {
  ...mockTourelleAssignee,
  id: 303,
  estDefaut: true,
};

describe('MountedEquipment', () => {
  let component: MountedEquipment;
  let fixture: ComponentFixture<MountedEquipment>;

  function setInputs(weapons: Weapon[], improvements: VehicleImprovement[]): void {
    fixture.componentRef.setInput('weapons', weapons);
    fixture.componentRef.setInput('improvements', improvements);
    fixture.componentRef.setInput('sponsorCatalog', mockSponsorCatalog);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MountedEquipment],
    }).compileComponents();

    fixture = TestBed.createComponent(MountedEquipment);
    component = fixture.componentInstance;
  });

  // ── Listes vides ────────────────────────────────────────────────────────────

  it('affiche un message dédié dans chaque section quand le véhicule n\'a encore aucun équipement', () => {
    setInputs([], []);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Aucune arme montée');
    expect(el.textContent).toContain('Aucune amélioration installée');
    expect(el.querySelectorAll('.me-item')).toHaveLength(0);
  });

  // ── Affichage standard (arme + amélioration non-Tourelle) ──────────────────

  it('affiche les titres de section avec le nombre d\'éléments, le nom résolu, l\'orientation et les badges prix/emplacement', () => {
    setInputs([mockWeapon], [mockImprovement]);

    const el = fixture.nativeElement as HTMLElement;
    const groupTitles = el.querySelectorAll('.me-group-title');

    expect(groupTitles[0].textContent).toContain('Armes (1)');
    expect(groupTitles[1].textContent).toContain('Améliorations (1)');

    // Noms RÉSOLUS depuis le catalogue (pas le nomInterne brut) + orientation.
    expect(el.textContent).toContain('Mitrailleuse');
    expect(el.textContent).toContain('(avant)');
    expect(el.textContent).toContain('Blindage');

    const badges = el.querySelectorAll('.me-badge');
    // Arme montée (mitrailleuse) : prix 4, emplacement résolu via le catalogue = 1.
    expect(badges[0].textContent).toContain('4');
    expect(badges[1].textContent).toContain('1');
    // Amélioration montée (blindage) : prix 4, emplacement 1 (déjà résolu par le DTO).
    expect(badges[2].textContent).toContain('4');
    expect(badges[3].textContent).toContain('1');

    expect(el.querySelectorAll('.me-remove')).toHaveLength(2);
  });

  it('résout le nom et l\'emplacement d\'une arme via le catalogue, avec repli sur le nomInterne/0', () => {
    setInputs([], []);

    expect(component.resolveWeaponName('mitrailleuse')).toBe('Mitrailleuse');
    expect(component.resolveWeaponName('inconnue')).toBe('inconnue');
    expect(component.resolveImprovementName('blindage')).toBe('Blindage');
    expect(component.resolveImprovementName('inconnue')).toBe('inconnue');
    expect(component.resolveWeaponSlot('mitrailleuse')).toBe(1);
    expect(component.resolveWeaponSlot('inconnue')).toBe(0);
  });

  // ── Badge 🔒 Intégré ─────────────────────────────────────────────────────────

  it('affiche le badge 🔒 Intégré (pas de bouton Retirer) pour une amélioration estDefaut', () => {
    setInputs([], [{ ...mockImprovement, estDefaut: true }]);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.me-badge-defaut')?.textContent).toContain('Intégré');
    expect(el.querySelector('.me-remove')).toBeNull();
  });

  // ── Tourelle ASSIGNÉE — ligne fusionnée "Arme (Tourelle)" ───────────────────

  it('fusionne une Tourelle assignée en une ligne "Arme (Tourelle)" avec son coût total et le bouton Désassigner', () => {
    setInputs([], [mockTourelleAssignee]);

    const el = fixture.nativeElement as HTMLElement;
    const item = el.querySelector('.me-item--tourelle') as HTMLElement;

    expect(item.textContent).toContain('BFG'); // arme résolue depuis weaponNomInterne
    expect(item.textContent).toContain('(Tourelle)');
    expect(item.textContent).toContain('(avant)');
    expect(item.textContent).toContain('54'); // prix total (3× BFG)

    const badges = item.querySelectorAll('.me-badge');
    expect(badges[1].textContent).toContain('2'); // emplacement de l'arme (BFG)

    expect(item.textContent).toContain('Désassigner');
    expect(item.textContent).toContain('Retirer la Tourelle');
  });

  it('Tourelle assignée intégrée (estDefaut) : Désassigner reste possible, mais pas de retrait — badge "Tourelle intégrée"', () => {
    setInputs([], [mockTourelleIntegree]);

    const el = fixture.nativeElement as HTMLElement;
    const item = el.querySelector('.me-item--tourelle') as HTMLElement;

    expect(item.textContent).toContain('Désassigner');
    expect(item.textContent).not.toContain('Retirer la Tourelle');
    expect(item.querySelector('.me-badge-defaut')?.textContent).toContain('Tourelle intégrée');
  });

  // ── Tourelle ORPHELINE — aucune arme assignée ────────────────────────────────

  it('affiche une Tourelle orpheline avec l\'avertissement et le bouton Assigner une arme', () => {
    setInputs([], [mockTourelleOrpheline]);

    const el = fixture.nativeElement as HTMLElement;
    const item = el.querySelector('.me-item--tourelle-orpheline') as HTMLElement;

    expect(item.textContent).toContain('Tourelle');
    expect(item.textContent).toContain('⚠ Aucune arme assignée');
    expect(item.textContent).toContain('Assigner une arme');
    expect(item.textContent).toContain('Retirer'); // pas estDefaut → bouton Retirer présent
  });

  it('Tourelle orpheline intégrée (estDefaut) : badge 🔒 Intégré, pas de bouton Retirer', () => {
    setInputs([], [{ ...mockTourelleOrpheline, estDefaut: true }]);

    const el = fixture.nativeElement as HTMLElement;
    const item = el.querySelector('.me-item--tourelle-orpheline') as HTMLElement;

    expect(item.querySelector('.me-badge-defaut')?.textContent).toContain('Intégré');
    expect(item.querySelector('.me-remove')).toBeNull();
  });

  // ── Outputs ─────────────────────────────────────────────────────────────────

  it('émet weaponRemoved au clic sur "Retirer" d\'une arme', () => {
    setInputs([mockWeapon], []);
    const emitted: Weapon[] = [];
    outputToObservable(component.weaponRemoved).subscribe((w) => emitted.push(w));

    (fixture.nativeElement.querySelector('.me-remove') as HTMLButtonElement).click();

    expect(emitted).toEqual([mockWeapon]);
  });

  it('émet improvementRemoved au clic sur "Retirer" d\'une amélioration standard', () => {
    setInputs([], [mockImprovement]);
    const emitted: VehicleImprovement[] = [];
    outputToObservable(component.improvementRemoved).subscribe((i) => emitted.push(i));

    (fixture.nativeElement.querySelector('.me-remove') as HTMLButtonElement).click();

    expect(emitted).toEqual([mockImprovement]);
  });

  it('émet tourelleAssignRequested au clic sur "Assigner une arme" d\'une Tourelle orpheline', () => {
    setInputs([], [mockTourelleOrpheline]);
    const emitted: VehicleImprovement[] = [];
    outputToObservable(component.tourelleAssignRequested).subscribe((i) => emitted.push(i));

    (fixture.nativeElement.querySelector('.me-add-weapon') as HTMLButtonElement).click();

    expect(emitted).toEqual([mockTourelleOrpheline]);
  });

  it('émet tourelleUnassignRequested au clic sur "Désassigner" d\'une Tourelle assignée', () => {
    setInputs([], [mockTourelleAssignee]);
    const emitted: VehicleImprovement[] = [];
    outputToObservable(component.tourelleUnassignRequested).subscribe((i) => emitted.push(i));

    const buttons = fixture.nativeElement.querySelectorAll('.me-remove') as NodeListOf<HTMLButtonElement>;
    // Premier bouton = "Désassigner" (cf. ordre du template).
    buttons[0].click();

    expect(emitted).toEqual([mockTourelleAssignee]);
  });

  it('émet improvementRemoved au clic sur "Retirer la Tourelle" d\'une Tourelle assignée non-défaut', () => {
    setInputs([], [mockTourelleAssignee]);
    const emitted: VehicleImprovement[] = [];
    outputToObservable(component.improvementRemoved).subscribe((i) => emitted.push(i));

    const buttons = fixture.nativeElement.querySelectorAll('.me-remove') as NodeListOf<HTMLButtonElement>;
    // Second bouton = "Retirer la Tourelle".
    buttons[1].click();

    expect(emitted).toEqual([mockTourelleAssignee]);
  });
});
