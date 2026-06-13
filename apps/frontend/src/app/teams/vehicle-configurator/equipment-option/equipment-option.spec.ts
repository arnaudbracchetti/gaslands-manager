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
  regles: 'Portée Moyenne. Lance 1D6.',
  disponible: true,
};

const unavailableOption: EquipmentOptionDto = {
  nom: 'BFG',
  nomInterne: 'bfg',
  prix: 18,
  emplacement: 2,
  description: 'Arme lourde dévastatrice à courte portée.',
  regles: 'Portée Courte. Lance 5D6.',
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
  regles: 'Portée Moyenne. Lance 1D6.',
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

  it('porte le nom complet dans l\'attribut `title` (tooltip natif au survol prolongé, si tronqué)', () => {
    setUp(availableOption);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.option__name')?.getAttribute('title')).toBe('Mitrailleuse');
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

  it('masque la description pendant le choix d\'orientation, et la réaffiche après "Annuler"', () => {
    setUp(availableOption, true);
    const el = fixture.nativeElement as HTMLElement;

    // État de repos : la description du catalogue est visible.
    expect(el.querySelector('.option__description')?.textContent).toContain(
      'Arme de base à Portée Moyenne lançant 1D6.',
    );

    // Choix d'orientation en cours : le sélecteur prend la place de la description.
    el.querySelector('.option__add')?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(el.querySelector('.option__description')).toBeNull();
    expect(el.querySelector('.option__orientations')).not.toBeNull();

    // "Annuler" : retour à l'état de repos, la description réapparaît.
    el.querySelector('.orientation-cancel')?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(el.querySelector('.option__description')?.textContent).toContain(
      'Arme de base à Portée Moyenne lançant 1D6.',
    );
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

  // ── Popup de détail (`EquipmentDetailModal`) ────────────────────────────────

  it('ouvre la popup de détail au clic sur la carte', () => {
    setUp(availableOption);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('app-equipment-detail-modal')).toBeNull();

    (el.querySelector('.option') as HTMLElement).click();
    fixture.detectChanges();

    expect(component.detailsOpen()).toBe(true);
    expect(el.querySelector('app-equipment-detail-modal')).not.toBeNull();
    expect(el.querySelector('.edm-modal__name')?.textContent).toContain('Mitrailleuse');
  });

  it('ne déclenche PAS l\'ouverture de la popup au clic sur "Ajouter" (stopPropagation)', () => {
    setUp(availableOption);

    const emitted: EquipmentChoice[] = [];
    outputToObservable(component.chosen).subscribe((c) => emitted.push(c));

    (fixture.nativeElement.querySelector('.option__add') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component.detailsOpen()).toBe(false);
    expect(emitted).toHaveLength(1);
  });

  it('referme la popup sans émettre au clic sur "Annuler" de la popup', () => {
    setUp(availableOption);
    const el = fixture.nativeElement as HTMLElement;

    const emitted: EquipmentChoice[] = [];
    outputToObservable(component.chosen).subscribe((c) => emitted.push(c));

    (el.querySelector('.option') as HTMLElement).click();
    fixture.detectChanges();

    (el.querySelector('.edm-modal__cancel') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component.detailsOpen()).toBe(false);
    expect(el.querySelector('app-equipment-detail-modal')).toBeNull();
    expect(emitted).toHaveLength(0);
  });

  it('émet chosen et referme la popup au clic sur "Ajouter" de la popup (équipement non-orientable)', () => {
    setUp(availableOption);
    const el = fixture.nativeElement as HTMLElement;

    const emitted: EquipmentChoice[] = [];
    outputToObservable(component.chosen).subscribe((c) => emitted.push(c));

    (el.querySelector('.option') as HTMLElement).click();
    fixture.detectChanges();

    (el.querySelector('.edm-modal__add') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(emitted).toEqual([{ nomInterne: 'mitrailleuse' }]);
    expect(component.detailsOpen()).toBe(false);
    expect(el.querySelector('app-equipment-detail-modal')).toBeNull();
  });

  it('ouvre le sélecteur d\'orientation (et referme la popup) au clic sur "Ajouter" de la popup (équipement orientable)', () => {
    setUp(availableOption, true);
    const el = fixture.nativeElement as HTMLElement;

    const emitted: EquipmentChoice[] = [];
    outputToObservable(component.chosen).subscribe((c) => emitted.push(c));

    (el.querySelector('.option') as HTMLElement).click();
    fixture.detectChanges();

    (el.querySelector('.edm-modal__add') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(emitted).toHaveLength(0);
    expect(component.detailsOpen()).toBe(false);
    expect(component.choosingOrientation()).toBe(true);
    expect(el.querySelectorAll('.orientation-btn')).toHaveLength(4);
  });

  it('n\'ouvre pas la popup de détail pendant le choix d\'orientation', () => {
    setUp(availableOption, true);
    const el = fixture.nativeElement as HTMLElement;

    // Ouvre le sélecteur d'orientation.
    (el.querySelector('.option__add') as HTMLButtonElement).click();
    fixture.detectChanges();

    // Clic sur la carte (en dehors des boutons d'orientation) — ignoré.
    (el.querySelector('.option') as HTMLElement).click();
    fixture.detectChanges();

    expect(component.detailsOpen()).toBe(false);
    expect(el.querySelector('app-equipment-detail-modal')).toBeNull();
  });
});
