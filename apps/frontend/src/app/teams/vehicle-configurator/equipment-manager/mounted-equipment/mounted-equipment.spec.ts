/**
 * Tests unitaires pour MountedEquipment.
 *
 * Composant "dumb" : on vérifie l'affichage des listes "Armes"/"Améliorations"
 * (y compris la résolution des noms/emplacements depuis `sponsorCatalog` et le
 * badge "(Tourelle)" sur une arme montée sur Tourelle), et l'émission des 2
 * outputs au clic sur chaque bouton d'action (mirroir de `team-card.spec.ts`
 * pour `outputToObservable`).
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { MountedEquipment } from './mounted-equipment';
import { Sponsor } from '../../../../catalog/catalog.model';
import { VehicleImprovement, Weapon, VehicleAdvantage } from '../../vehicle-builder.model';

// Catalogue minimal — sert à résoudre noms/emplacements affichés.
const mockSponsorCatalog: Sponsor = {
  nom: 'Rutherford',
  description: 'Sponsor militaire.',
  classes_avantage: ['Militaire'],
  avantages_sponsorises: '',
  vehicules: [],
  armes: [
    { nom: 'Mitrailleuse', nom_interne: 'mitrailleuse', type: 'base', prix: 4, emplacement: 1, description: '', regles: '', sponsors_autorises: ['Rutherford'], necessite_orientation: true },
    { nom: 'BFG', nom_interne: 'bfg', type: 'avancée', prix: 18, emplacement: 2, description: '', regles: '', sponsors_autorises: ['Rutherford'], montable_tourelle: true, necessite_orientation: true },
  ],
  ameliorations: [
    { nom: 'Blindage', nom_interne: 'blindage', prix: 4, emplacement: 1, description: '', regles: '', sponsors_autorises: ['Rutherford'], necessite_orientation: false },
  ],
  avantages: [
    { nom: 'Tireur d\'Élite', nom_interne: 'tireur_elite', categorie: 'Militaire', prix: 2, description: '', regles: '' },
  ],
};

const mockWeapon: Weapon = {
  id: 200,
  nomInterne: 'mitrailleuse',
  orientation: 'avant',
  vehicleId: 100,
  createdAt: '2026-01-01T00:00:01.000Z',
  prix: 4,
  emplacement: 1, // résiduel résolu côté backend (Weapon.slots) — plus de résolution catalogue
  estDefaut: false,
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
};

// Arme montée sur Tourelle — coût ×3, arc à 360° (pas d'orientation).
const mockWeaponTourelle: Weapon = {
  id: 201,
  nomInterne: 'bfg',
  orientation: 'tourelle',
  vehicleId: 100,
  createdAt: '2026-01-01T00:00:03.000Z',
  prix: 54, // 3 × 18 (BFG)
  emplacement: 2, // slot catalogue du BFG (le montage Tourelle ne change que le coût)
  estDefaut: false,
};

// Arme intégrée au profil de base (Canon de 125mm du Char d'assaut) — non retirable.
const mockWeaponDefaut: Weapon = {
  ...mockWeaponTourelle,
  id: 202,
  prix: 0,
  emplacement: 0, // estDefaut ⇒ hors pool d'emplacements (Weapon.slots)
  estDefaut: true,
};

const mockAdvantage: VehicleAdvantage = {
  id: 400,
  nomInterne: 'tireur_elite',
  vehicleId: 100,
  createdAt: '2026-01-01T00:00:04.000Z',
  prix: 2,
};

describe('MountedEquipment', () => {
  let component: MountedEquipment;
  let fixture: ComponentFixture<MountedEquipment>;

  function setInputs(weapons: Weapon[], improvements: VehicleImprovement[], advantages: VehicleAdvantage[] = []): void {
    fixture.componentRef.setInput('weapons', weapons);
    fixture.componentRef.setInput('improvements', improvements);
    fixture.componentRef.setInput('advantages', advantages);
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
    expect(el.textContent).toContain('Aucun avantage acquis');
    expect(el.querySelectorAll('.me-item')).toHaveLength(0);
  });

  // ── Affichage standard (arme + amélioration) ────────────────────────────────

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
    // Arme montée (mitrailleuse) : prix 4, emplacement 1 — lu directement sur le DTO
    // (`weapon.emplacement`), plus de résolution catalogue.
    expect(badges[0].textContent).toContain('4');
    expect(badges[1].textContent).toContain('1');
    // Amélioration montée (blindage) : prix 4, emplacement 1 (déjà résolu par le DTO).
    expect(badges[2].textContent).toContain('4');
    expect(badges[3].textContent).toContain('1');

    expect(el.querySelectorAll('.me-remove')).toHaveLength(2);
  });

  it('résout le nom d\'une arme/amélioration via le catalogue, avec repli sur le nomInterne', () => {
    setInputs([], []);

    expect(component.resolveWeaponName('mitrailleuse')).toBe('Mitrailleuse');
    expect(component.resolveWeaponName('inconnue')).toBe('inconnue');
    expect(component.resolveImprovementName('blindage')).toBe('Blindage');
    expect(component.resolveImprovementName('inconnue')).toBe('inconnue');
  });

  // ── Badge 🔒 Intégré ─────────────────────────────────────────────────────────

  it('affiche le badge 🔒 Intégré (pas de bouton Retirer) pour une amélioration estDefaut', () => {
    setInputs([], [{ ...mockImprovement, estDefaut: true }]);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.me-badge-defaut')?.textContent).toContain('Intégré');
    expect(el.querySelector('.me-remove')).toBeNull();
  });

  // ── Badge "Vendue" (atelier — annulation vs revente) ────────────────────────

  it('masque par défaut un objet vendu (filtre "showSold"), révélé une fois le filtre activé', () => {
    setInputs([{ ...mockWeapon, sold: true }], []);

    let el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.me-item')).toBeNull();
    expect(el.textContent).toContain('Toutes les armes de ce véhicule ont été vendues');

    component.showSold.set(true);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.me-item__watermark')).not.toBeNull();
  });

  it('affiche le filigrane "Vendu" (pas de bouton Retirer) pour une arme vendue, nom barré', () => {
    setInputs([{ ...mockWeapon, sold: true }], []);
    component.showSold.set(true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.me-item__watermark')?.textContent).toContain('Vendu');
    expect(el.querySelector('.me-item--sold')).not.toBeNull();
    expect(el.querySelector('.me-name--sold')).not.toBeNull();
    expect(el.querySelector('.me-remove')).toBeNull();
    // Reste visible malgré la vente — traçabilité.
    expect(el.textContent).toContain('Mitrailleuse');
  });

  it('arme vendue : slot résiduel 0 (lu sur le DTO) + tooltips prix/slot "résiduel après revente"', () => {
    // Backend : Weapon.slots ⇒ 0 quand vendue (emplacement libéré), prix ⇒ résiduel.
    setInputs([{ ...mockWeapon, sold: true, emplacement: 0, prix: 2 }], []);
    component.showSold.set(true);
    fixture.detectChanges();

    const badges = fixture.nativeElement.querySelectorAll('.me-badge');
    // badges[0] = prix résiduel, badges[1] = slot résiduel (0).
    expect(badges[0].textContent).toContain('2');
    expect(badges[0].getAttribute('title')).toBe('Coût résiduel après revente');
    expect(badges[1].textContent).toContain('0');
    expect(badges[1].getAttribute('title')).toBe('Emplacement(s) occupé(s) après la revente');
  });

  it('affiche le filigrane "Vendu" pour une amélioration vendue, sans bouton Retirer', () => {
    setInputs([], [{ ...mockImprovement, sold: true }]);
    component.showSold.set(true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.me-item__watermark')?.textContent).toContain('Vendu');
    expect(el.querySelector('.me-name--sold')).not.toBeNull();
    expect(el.querySelector('.me-remove')).toBeNull();
    expect(el.textContent).toContain('Blindage');
  });

  it('estDefaut prime sur sold : badge "Intégré" affiché même si sold=true (cas théorique)', () => {
    setInputs([], [{ ...mockImprovement, estDefaut: true, sold: true }]);
    component.showSold.set(true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.me-badge-defaut')?.textContent).toContain('Intégré');
    // `sold` reste vrai indépendamment de estDefaut — le filigrane s'affiche quand même,
    // seul le bouton d'action (Retirer vs Intégré) dépend de la priorité estDefaut.
    expect(el.querySelector('.me-item__watermark')).not.toBeNull();
  });

  // ── Arme montée sur Tourelle (attribut de l'arme) ───────────────────────────

  it('affiche le badge "(Tourelle)" et le coût ×3 pour une arme montée sur Tourelle, sans orientation', () => {
    setInputs([mockWeaponTourelle], []);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('BFG');
    expect(el.textContent).toContain('(Tourelle)');
    expect(el.textContent).not.toContain('(avant)');
    expect(el.textContent).toContain('54'); // prix total (3× BFG)

    expect(el.querySelectorAll('.me-remove')).toHaveLength(1);
  });

  it('arme intégrée montée sur Tourelle (Canon de 125mm du Char d\'assaut) : badge Intégré, pas de bouton Retirer', () => {
    setInputs([mockWeaponDefaut], []);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.me-badge-defaut')?.textContent).toContain('Intégré');
    expect(el.querySelector('.me-remove')).toBeNull();
  });

  it('équipement intégré (estDefaut) : tooltips prix/slot explicatifs, estDefaut prime sur Tourelle et vente', () => {
    // Arme intégrée (Canon de 125mm : estDefaut ET Tourelle) + amélioration intégrée.
    setInputs([mockWeaponDefaut], [{ ...mockImprovement, estDefaut: true }]);

    const badges = fixture.nativeElement.querySelectorAll('.me-badge');
    // Arme intégrée : prix 0 / slot 0, tooltips "intégré" (pas "×3" malgré la Tourelle).
    expect(badges[0].getAttribute('title')).toBe('Équipement intégré au profil de base — gratuit');
    expect(badges[1].getAttribute('title')).toBe('Équipement intégré au profil de base — aucun emplacement consommé');
    // Amélioration intégrée : mêmes tooltips.
    expect(badges[2].getAttribute('title')).toBe('Équipement intégré au profil de base — gratuit');
    expect(badges[3].getAttribute('title')).toBe('Équipement intégré au profil de base — aucun emplacement consommé');
  });

  // ── Outputs ─────────────────────────────────────────────────────────────────

  it('émet weaponRemoved au clic sur "Retirer" d\'une arme', () => {
    setInputs([mockWeapon], []);
    const emitted: Weapon[] = [];
    outputToObservable(component.weaponRemoved).subscribe((w) => emitted.push(w));

    (fixture.nativeElement.querySelector('.me-remove') as HTMLButtonElement).click();

    expect(emitted).toEqual([mockWeapon]);
  });

  it('émet weaponRemoved au clic sur "Retirer" d\'une arme montée sur Tourelle', () => {
    setInputs([mockWeaponTourelle], []);
    const emitted: Weapon[] = [];
    outputToObservable(component.weaponRemoved).subscribe((w) => emitted.push(w));

    (fixture.nativeElement.querySelector('.me-remove') as HTMLButtonElement).click();

    expect(emitted).toEqual([mockWeaponTourelle]);
  });

  it('émet improvementRemoved au clic sur "Retirer" d\'une amélioration standard', () => {
    setInputs([], [mockImprovement]);
    const emitted: VehicleImprovement[] = [];
    outputToObservable(component.improvementRemoved).subscribe((i) => emitted.push(i));

    (fixture.nativeElement.querySelector('.me-remove') as HTMLButtonElement).click();

    expect(emitted).toEqual([mockImprovement]);
  });

  // ── Avantages (jamais d'orientation ni d'emplacement, perte totale à la revente) ──

  it('affiche le titre de section, le nom résolu et le badge prix (sans badge emplacement) pour un avantage acquis', () => {
    setInputs([], [], [mockAdvantage]);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Avantages (1)');
    expect(el.textContent).toContain('Tireur d\'Élite');
    expect(el.textContent).toContain('2');
    expect(el.querySelectorAll('.me-remove')).toHaveLength(1);
  });

  it('masque par défaut un avantage vendu (filtre "showSold"), révélé une fois le filtre activé', () => {
    setInputs([], [], [{ ...mockAdvantage, sold: true }]);

    let el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Tous les avantages de ce véhicule ont été vendus');

    component.showSold.set(true);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.me-item__watermark')).not.toBeNull();
  });

  it('affiche le filigrane "Vendu" (pas de bouton Retirer) pour un avantage vendu, prix INCHANGÉ (perte totale, pas de résiduel)', () => {
    setInputs([], [], [{ ...mockAdvantage, sold: true }]);
    component.showSold.set(true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.me-item__watermark')?.textContent).toContain('Vendu');
    expect(el.querySelector('.me-name--sold')).not.toBeNull();
    expect(el.querySelector('.me-remove')).toBeNull();
    expect(el.textContent).toContain('Tireur d\'Élite');
    expect(el.textContent).toContain('2'); // prix catalogue plein, jamais réduit
  });

  it('émet advantageRemoved au clic sur "Retirer" d\'un avantage', () => {
    setInputs([], [], [mockAdvantage]);
    const emitted: VehicleAdvantage[] = [];
    outputToObservable(component.advantageRemoved).subscribe((a) => emitted.push(a));

    (fixture.nativeElement.querySelector('.me-remove') as HTMLButtonElement).click();

    expect(emitted).toEqual([mockAdvantage]);
  });
});
