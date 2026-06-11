/**
 * Tests unitaires pour EquipmentOption.
 *
 * Mirroir de `team-card.spec.ts` (cf. son en-tête) : composant "dumb", on
 * vérifie l'affichage du verdict de disponibilité ET le flux d'émission de
 * `chosen` — en particulier le point UX central de ce composant (cf. en-tête
 * de `equipment-option.ts`) : ne JAMAIS émettre sans orientation pour un
 * équipement orientable.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { EquipmentOption } from './equipment-option';
import { EquipmentChoice, EquipmentOption as EquipmentOptionDto } from '../vehicle-builder.model';

const availableOption: EquipmentOptionDto = {
  nom: 'Mitrailleuse',
  nomInterne: 'mitrailleuse',
  prix: 4,
  emplacement: 1,
  description: 'Arme de base à Portée Moyenne lançant 1D6.',
  disponible: true,
};

const unavailableOption: EquipmentOptionDto = {
  nom: 'BFG',
  nomInterne: 'bfg',
  prix: 18,
  emplacement: 2,
  description: 'Arme lourde dévastatrice à courte portée.',
  disponible: false,
  raison: 'Emplacements insuffisants : 6/5 requis avec "BFG"',
};

// Cas particulier documenté côté backend (cf. doc de `requiresOrientation`,
// `equipment-option.ts`) : un équipement orientable revient TOUJOURS avec
// `disponible: false` et cette raison précise, tant qu'aucune orientation n'a
// été choisie — "il manque une information", pas "c'est interdit".
const orientableOption: EquipmentOptionDto = {
  nom: 'Mitrailleuse',
  nomInterne: 'mitrailleuse',
  prix: 4,
  emplacement: 1,
  description: 'Arme de base à Portée Moyenne lançant 1D6.',
  disponible: false,
  raison: 'Une orientation est requise pour monter "Mitrailleuse" sur un arc de tir',
};

describe('EquipmentOption', () => {
  let component: EquipmentOption;
  let fixture: ComponentFixture<EquipmentOption>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EquipmentOption],
    }).compileComponents();

    fixture = TestBed.createComponent(EquipmentOption);
    component = fixture.componentInstance;
  });

  function setUp(option: EquipmentOptionDto, requiresOrientation = false): void {
    fixture.componentRef.setInput('option', option);
    fixture.componentRef.setInput('requiresOrientation', requiresOrientation);
    fixture.detectChanges();
  }

  // ── Affichage ──────────────────────────────────────────────────────────────

  it('affiche le nom, le prix et l\'emplacement requis', () => {
    setUp(availableOption);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.option__name')?.textContent).toContain('Mitrailleuse');
    expect(el.textContent).toContain('4');
    expect(el.textContent).toContain('1');
  });

  it('affiche la description issue du catalogue', () => {
    setUp(availableOption);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.option__description')?.textContent).toContain(
      'Arme de base à Portée Moyenne lançant 1D6.',
    );
  });

  it('affiche un bouton "Ajouter" quand l\'option est disponible', () => {
    setUp(availableOption);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.option__add')).not.toBeNull();
    expect(el.querySelector('.option__reason')).toBeNull();
  });

  it('affiche la raison et masque "Ajouter" quand l\'option est indisponible', () => {
    setUp(unavailableOption);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.option__reason')?.textContent).toContain('Emplacements insuffisants');
    expect(el.querySelector('.option__add')).toBeNull();
  });

  it('applique la classe `option--unavailable` quand l\'option est indisponible et non-orientable', () => {
    setUp(unavailableOption);
    const el = fixture.nativeElement.querySelector('.option') as HTMLElement;

    expect(el.classList.contains('option--unavailable')).toBe(true);
  });

  // ── Cas particulier : "orientation requise" (cf. doc de `requiresOrientation`) ──
  // Le backend renvoie SYSTÉMATIQUEMENT `disponible: false` pour ces options tant
  // qu'aucune orientation n'a été choisie — "il manque une info", pas "c'est interdit".
  // `EquipmentOption` doit donc proposer "Ajouter" (qui ouvre le sélecteur), PAS
  // afficher la raison comme un refus définitif.

  it('propose "Ajouter" (et masque la raison) pour une option indisponible mais orientable', () => {
    setUp(orientableOption, true);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.option__add')).not.toBeNull();
    expect(el.querySelector('.option__reason')).toBeNull();
  });

  it('n\'applique PAS la classe `option--unavailable` pour une option indisponible mais orientable', () => {
    setUp(orientableOption, true);
    const el = fixture.nativeElement.querySelector('.option') as HTMLElement;

    expect(el.classList.contains('option--unavailable')).toBe(false);
  });

  it('ouvre le sélecteur d\'orientation au clic sur "Ajouter" pour une option indisponible mais orientable', () => {
    setUp(orientableOption, true);

    const emitted: EquipmentChoice[] = [];
    outputToObservable(component.chosen).subscribe((c) => emitted.push(c));

    fixture.nativeElement.querySelector('.option__add')?.click();
    fixture.detectChanges();

    expect(emitted).toHaveLength(0);
    expect(component.choosingOrientation()).toBe(true);
  });

  // ── Émission sans orientation requise ──────────────────────────────────────

  it('émet chosen({ nomInterne }) directement au clic sur "Ajouter" (équipement non-orientable)', () => {
    setUp(availableOption, false);

    const emitted: EquipmentChoice[] = [];
    outputToObservable(component.chosen).subscribe((c) => emitted.push(c));

    const btn = fixture.nativeElement.querySelector('.option__add') as HTMLButtonElement;
    btn.click();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual({ nomInterne: 'mitrailleuse' });
  });

  // ── Flux d'orientation (point UX central — cf. en-tête) ─────────────────────

  it('ouvre le sélecteur d\'orientation au lieu d\'émettre quand l\'orientation est requise', () => {
    setUp(availableOption, true);

    const emitted: EquipmentChoice[] = [];
    outputToObservable(component.chosen).subscribe((c) => emitted.push(c));

    const btn = fixture.nativeElement.querySelector('.option__add') as HTMLButtonElement;
    btn.click();
    fixture.detectChanges();

    // Aucune émission prématurée — c'est LE point UX à garantir.
    expect(emitted).toHaveLength(0);
    expect(component.choosingOrientation()).toBe(true);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.orientation-btn')).toHaveLength(4);
  });

  it('émet chosen({ nomInterne, orientation }) au clic sur une direction', () => {
    setUp(availableOption, true);

    const emitted: EquipmentChoice[] = [];
    outputToObservable(component.chosen).subscribe((c) => emitted.push(c));

    fixture.nativeElement.querySelector('.option__add')?.click();
    fixture.detectChanges();

    const orientationButtons = fixture.nativeElement.querySelectorAll('.orientation-btn');
    (orientationButtons[0] as HTMLButtonElement).click();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual({ nomInterne: 'mitrailleuse', orientation: 'avant' });
  });

  // ── Extension de la carte pendant le choix d'orientation (cf. host binding) ──
  // Item de grille `.em-equipment__list` (cf. equipment-manager.scss) : pendant
  // le choix d'orientation, l'hôte reçoit `option-host--expanded` pour s'étendre
  // sur toute la largeur (`grid-column: 1 / -1`).

  it('ajoute la classe `option-host--expanded` sur l\'hôte pendant le choix d\'orientation', () => {
    setUp(availableOption, true);
    const host = fixture.nativeElement as HTMLElement;

    expect(host.classList.contains('option-host--expanded')).toBe(false);

    (host.querySelector('.option__add') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(host.classList.contains('option-host--expanded')).toBe(true);
  });

  it('retire la classe `option-host--expanded` après "Annuler"', () => {
    setUp(availableOption, true);
    const host = fixture.nativeElement as HTMLElement;

    (host.querySelector('.option__add') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(host.classList.contains('option-host--expanded')).toBe(true);

    (host.querySelector('.orientation-cancel') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(host.classList.contains('option-host--expanded')).toBe(false);
  });

  it('referme le sélecteur sans émettre au clic sur "Annuler"', () => {
    setUp(availableOption, true);

    const emitted: EquipmentChoice[] = [];
    outputToObservable(component.chosen).subscribe((c) => emitted.push(c));

    fixture.nativeElement.querySelector('.option__add')?.click();
    fixture.detectChanges();

    const cancelBtn = fixture.nativeElement.querySelector('.orientation-cancel') as HTMLButtonElement;
    cancelBtn.click();
    fixture.detectChanges();

    expect(emitted).toHaveLength(0);
    expect(component.choosingOrientation()).toBe(false);
    expect(fixture.nativeElement.querySelector('.option__add')).not.toBeNull();
  });
});
