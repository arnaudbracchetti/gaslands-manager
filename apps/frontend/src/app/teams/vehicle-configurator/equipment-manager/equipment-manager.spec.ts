/**
 * Tests unitaires pour EquipmentManager — composant "smart" PARTAGÉ de gestion
 * de l'équipement d'un véhicule (cf. son en-tête : extraction de la duplication
 * EXACTE entre l'ex-`VehicleBuilder` (étape 2) et l'ex-`VehicleEditor`).
 *
 * C'est désormais la SEULE source de vérité pour cette logique : calcul des
 * emplacements, chargement/affichage des équipements disponibles, ajout ET
 * retrait d'armes/améliorations (toujours proposé — cf. en-tête, "Retrait
 * TOUJOURS proposé"), détection d'orientation requise, résolution des noms.
 *
 * Mirroir de `vehicle-configurator.spec.ts` (cf. son en-tête) côté approche :
 * composant "smart", on appelle directement les méthodes publiques plutôt que
 * de simuler des clics à travers les sous-composants dumb (`EquipmentOption`,
 * déjà couvert par sa propre spec).
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { EquipmentManager } from './equipment-manager';
import { VehicleService } from '../vehicle.service';
import { Sponsor, Vehicule } from '../../../catalog/catalog.model';
import { Team } from '../../team.model';
import { AvailableImprovementDto, AvailableWeaponDto, Vehicle } from '../vehicle-builder.model';

// ── Données fictives ──────────────────────────────────────────────────────────

const mockTeam: Team = {
  id: 7,
  name: 'Les Furieux du Désert',
  sponsor: 'Rutherford',
  cans: 50,
  userId: 42,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  vehicleCount: 1,
};

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

// Catalogue complet du sponsor — sert au calcul des emplacements (`armes`/
// `ameliorations`, résolution `nomInterne → emplacement`) ET à la résolution
// des noms affichés (cf. `resolveWeaponName`/`resolveImprovementName`).
const mockSponsorCatalog: Sponsor = {
  nom: 'Rutherford',
  description: 'Sponsor militaire.',
  classes_avantage: ['Militaire'],
  avantages_sponsorises: '',
  vehicules: [mockVehicule],
  armes: [
    {
      nom: 'Mitrailleuse',
      nom_interne: 'mitrailleuse',
      type: 'base',
      prix: 4,
      emplacement: 1,
      description: '',
      regles: '',
      sponsors_autorises: ['Rutherford'],
    },
  ],
  ameliorations: [
    {
      nom: 'Blindage',
      nom_interne: 'blindage',
      prix: 4,
      emplacement: 1,
      description: '',
      regles: '',
      sponsors_autorises: ['Rutherford'],
    },
  ],
};

// Véhicule "nu" — point de départ commun aux deux contextes (création OU édition,
// ce composant ignore lequel — cf. en-tête).
const mockVehicle: Vehicle = {
  id: 100,
  nomInterne: 'camion',
  teamId: 7,
  improvements: [],
  weapons: [],
  createdAt: '2026-01-01T00:00:00.000Z',
};

// Véhicule équipé d'une arme — utilisé pour la section "Équipement actuel" et
// le recalcul des emplacements consommés.
const mockVehicleWithWeapon: Vehicle = {
  ...mockVehicle,
  weapons: [{ id: 200, nomInterne: 'mitrailleuse', orientation: 'avant', vehicleId: 100, createdAt: '2026-01-01T00:00:01.000Z', prix: 4 }],
};

// Véhicule équipé d'une amélioration — sert au mirroir `removeImprovement`/`addImprovement`.
const mockVehicleWithImprovement: Vehicle = {
  ...mockVehicle,
  improvements: [{ id: 300, nomInterne: 'blindage', orientation: null, vehicleId: 100, createdAt: '2026-01-01T00:00:02.000Z', estDefaut: false, prix: 4, emplacement: 1, weaponNomInterne: null }],
};

const mockAvailableWeapon: AvailableWeaponDto = {
  nom: 'Mitrailleuse',
  nomInterne: 'mitrailleuse',
  prix: 4,
  emplacement: 1,
  type: 'base',
  description: '',
  disponible: true,
};

const mockAvailableImprovement: AvailableImprovementDto = {
  nom: 'Blindage',
  nomInterne: 'blindage',
  prix: 4,
  emplacement: 1,
  description: '',
  disponible: true,
};

// ── Options pour les tests du filtre "Afficher les indisponibles" ─────────────

// Refus DÉFINITIF (sponsor/emplacements/règle de pose) — masquée par défaut.
const mockUnavailableWeapon: AvailableWeaponDto = {
  nom: 'BFG',
  nomInterne: 'bfg',
  prix: 18,
  emplacement: 2,
  type: 'avancée',
  description: '',
  disponible: false,
  raison: 'Emplacements insuffisants : 6/4 requis avec "BFG"',
};

// "Il manque une information" (orientation) — TOUJOURS visible, cf.
// `weaponNeedsOrientation` (contrat textuel `raison`).
const mockOrientableWeapon: AvailableWeaponDto = {
  nom: 'Lance-Flammes',
  nomInterne: 'lance_flammes',
  prix: 6,
  emplacement: 1,
  type: 'avancée',
  description: '',
  disponible: false,
  raison: 'Une orientation est requise pour monter "Lance-Flammes" sur un arc de tir',
};

const mockUnavailableImprovement: AvailableImprovementDto = {
  nom: 'Nitro',
  nomInterne: 'nitro',
  prix: 6,
  emplacement: 0,
  description: '',
  disponible: false,
  raison: 'Cette amélioration est réservée à un autre sponsor',
};

describe('EquipmentManager', () => {
  let component: EquipmentManager;
  let fixture: ComponentFixture<EquipmentManager>;
  let mockVehicleService: {
    getAvailableWeapons: ReturnType<typeof vi.fn>;
    getAvailableImprovements: ReturnType<typeof vi.fn>;
    addWeapon: ReturnType<typeof vi.fn>;
    addImprovement: ReturnType<typeof vi.fn>;
    removeWeapon: ReturnType<typeof vi.fn>;
    removeImprovement: ReturnType<typeof vi.fn>;
    getAllForTeam: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockVehicleService = {
      getAvailableWeapons: vi.fn().mockReturnValue(of([mockAvailableWeapon])),
      getAvailableImprovements: vi.fn().mockReturnValue(of([mockAvailableImprovement])),
      addWeapon: vi.fn().mockReturnValue(of(mockVehicleWithWeapon)),
      addImprovement: vi.fn().mockReturnValue(of(mockVehicleWithImprovement)),
      removeWeapon: vi.fn().mockReturnValue(of(undefined)),
      removeImprovement: vi.fn().mockReturnValue(of(undefined)),
      getAllForTeam: vi.fn().mockReturnValue(of([mockVehicle])),
    };

    await TestBed.configureTestingModule({
      imports: [EquipmentManager],
      providers: [{ provide: VehicleService, useValue: mockVehicleService }],
    }).compileComponents();

    fixture = TestBed.createComponent(EquipmentManager);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('vehicle', mockVehicle);
    fixture.componentRef.setInput('sponsorCatalog', mockSponsorCatalog);
    fixture.componentRef.setInput('team', mockTeam);
    // detectChanges() déclenche l'`effect()` du constructeur → charge les
    // équipements disponibles (cf. en-tête, "Réaction aux changements de véhicule").
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  // ── Chargement et affichage de l'équipement disponible ─────────────────────

  it('charge les équipements disponibles au premier rendu (effect → loadAvailableEquipment)', () => {
    expect(mockVehicleService.getAvailableWeapons).toHaveBeenCalledExactlyOnceWith(100);
    expect(mockVehicleService.getAvailableImprovements).toHaveBeenCalledExactlyOnceWith(100);
    expect(component.availableWeapons()).toEqual([mockAvailableWeapon]);
    expect(component.availableImprovements()).toEqual([mockAvailableImprovement]);
    expect(component.loadingEquipment()).toBe(false);
  });

  it('affiche une arme et une amélioration disponibles dans leurs sections respectives', () => {
    const el = fixture.nativeElement as HTMLElement;
    const options = el.querySelectorAll('app-equipment-option');

    expect(options).toHaveLength(2);
    expect(el.textContent).toContain('Mitrailleuse');
    expect(el.textContent).toContain('Blindage');
  });

  it('affiche une erreur si le chargement des équipements disponibles échoue', () => {
    mockVehicleService.getAvailableWeapons.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

    fixture = TestBed.createComponent(EquipmentManager);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('vehicle', mockVehicle);
    fixture.componentRef.setInput('sponsorCatalog', mockSponsorCatalog);
    fixture.componentRef.setInput('team', mockTeam);
    fixture.detectChanges();

    expect(component.equipmentError()).not.toBe('');
    expect(component.loadingEquipment()).toBe(false);
  });

  // ── Calcul des emplacements (pool partagé armes + améliorations) ───────────

  it('calcule les emplacements totaux depuis le catalogue et 0 utilisé pour un véhicule nu', () => {
    expect(component.emplacementsTotal()).toBe(4);
    expect(component.emplacementsUtilises()).toBe(0);
  });

  it('recalcule les emplacements utilisés en fonction des armes ET améliorations montées (pool partagé)', () => {
    fixture.componentRef.setInput('vehicle', {
      ...mockVehicle,
      weapons: mockVehicleWithWeapon.weapons,
      improvements: mockVehicleWithImprovement.improvements,
    });
    fixture.detectChanges();

    // mitrailleuse (1) + blindage (1) = 2 emplacements consommés
    expect(component.emplacementsUtilises()).toBe(2);
  });

  // ── Coût (computed) — carte récapitulative (en-tête de `.em-current`) ──────

  it('coutBase reflète le prix catalogue du véhicule, coutEquipement est nul et coutTotal égal coutBase pour un véhicule nu', () => {
    expect(component.coutBase()).toBe(16); // mockVehicule.prix
    expect(component.coutEquipement()).toBe(0);
    expect(component.coutTotal()).toBe(16);
  });

  it('coutEquipement additionne les prix EFFECTIFS des armes et améliorations montées, coutTotal = base + équipement', () => {
    fixture.componentRef.setInput('vehicle', {
      ...mockVehicle,
      weapons: mockVehicleWithWeapon.weapons,
      improvements: mockVehicleWithImprovement.improvements,
    });
    fixture.detectChanges();

    // mitrailleuse (4) + blindage (4) = 8
    expect(component.coutEquipement()).toBe(8);
    expect(component.coutTotal()).toBe(24); // 16 (base) + 8 (équipement)
  });

  // ── Résolution de l'emplacement d'une arme montée (badge 🔧 des lignes "Armes") ──

  it('résout l\'emplacement consommé par une arme depuis le catalogue, avec repli sur 0', () => {
    expect(component.resolveWeaponSlot('mitrailleuse')).toBe(1);
    expect(component.resolveWeaponSlot('inconnue')).toBe(0);
  });

  // ── En-tête récapitulatif `.em-current__header` (nom, emplacements, coût) ──

  it('affiche le nom du véhicule, les emplacements et le détail du coût (base / équipement / total) dans l\'en-tête récap', () => {
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.em-current__vehicle-name')?.textContent?.trim()).toBe('Camion');
    expect(el.querySelector('.em-current__slots')?.textContent).toContain('0 / 4');

    const costRows = el.querySelectorAll('.em-current__cost-row');
    expect(costRows[0].textContent).toContain('Base');
    expect(costRows[0].textContent).toContain('16');
    expect(costRows[1].textContent).toContain('Équipement');
    expect(costRows[1].textContent).toContain('0');
    expect(costRows[2].textContent).toContain('Total');
    expect(costRows[2].textContent).toContain('16');
    expect(costRows[2].classList).toContain('em-current__cost-row--total');
  });

  it('met à jour le coût total de l\'en-tête récap quand de l\'équipement est monté', () => {
    fixture.componentRef.setInput('vehicle', {
      ...mockVehicle,
      weapons: mockVehicleWithWeapon.weapons,
      improvements: mockVehicleWithImprovement.improvements,
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const costRows = el.querySelectorAll('.em-current__cost-row');
    expect(costRows[1].textContent).toContain('8'); // + Équipement
    expect(costRows[2].textContent).toContain('24'); // = Total
  });

  // ── Sections "Armes (N)" / "Améliorations (N)" et badges prix/emplacement ──

  it('affiche les titres de section avec le nombre d\'éléments et les badges prix/emplacement par ligne', () => {
    fixture.componentRef.setInput('vehicle', {
      ...mockVehicle,
      weapons: mockVehicleWithWeapon.weapons,
      improvements: mockVehicleWithImprovement.improvements,
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const groupTitles = el.querySelectorAll('.em-current__group-title');

    expect(groupTitles[0].textContent).toContain('Armes (1)');
    expect(groupTitles[1].textContent).toContain('Améliorations (1)');

    const badges = el.querySelectorAll('.em-current__badge');
    // Arme montée (mitrailleuse) : prix 4, emplacement 1.
    expect(badges[0].textContent).toContain('4');
    expect(badges[1].textContent).toContain('1');
    // Amélioration montée (blindage) : prix 4, emplacement 1.
    expect(badges[2].textContent).toContain('4');
    expect(badges[3].textContent).toContain('1');
  });

  // ── Ajout d'arme ────────────────────────────────────────────────────────────

  it('ajoute une arme et notifie le parent via vehicleChanged avec l\'entité mise à jour', () => {
    const emitted: Vehicle[] = [];
    outputToObservable(component.vehicleChanged).subscribe((v) => emitted.push(v));
    vi.clearAllMocks(); // ne compter que les appels déclenchés par addWeapon

    component.addWeapon({ nomInterne: 'mitrailleuse', orientation: 'avant' });

    expect(mockVehicleService.addWeapon).toHaveBeenCalledExactlyOnceWith(100, { nomInterne: 'mitrailleuse', orientation: 'avant' });
    expect(emitted).toEqual([mockVehicleWithWeapon]);
  });

  it('recharge automatiquement les verdicts de disponibilité après un ajout réussi (via l\'effect réagissant à `vehicle`)', () => {
    fixture.componentRef.setInput('vehicle', mockVehicleWithWeapon);
    fixture.detectChanges();

    // Le composant ne déclenche PAS lui-même de rechargement : c'est l'`effect()`
    // du constructeur, réagissant au nouvel input `vehicle`, qui s'en charge —
    // cf. en-tête, "inutile de le faire ici explicitement".
    expect(mockVehicleService.getAvailableWeapons).toHaveBeenCalledWith(100);
    expect(mockVehicleService.getAvailableImprovements).toHaveBeenCalledWith(100);
  });

  it('affiche la raison du refus si l\'ajout d\'une arme échoue, sans émettre vehicleChanged', () => {
    mockVehicleService.addWeapon.mockReturnValue(
      throwError(() => new HttpErrorResponse({ error: { message: 'Emplacements insuffisants : 5/4 requis avec "Mitrailleuse"' }, status: 400 })),
    );
    const emitted: Vehicle[] = [];
    outputToObservable(component.vehicleChanged).subscribe((v) => emitted.push(v));

    component.addWeapon({ nomInterne: 'mitrailleuse', orientation: 'avant' });

    expect(component.equipmentError()).toBe('Emplacements insuffisants : 5/4 requis avec "Mitrailleuse"');
    expect(emitted).toHaveLength(0);
  });

  // ── Ajout d'amélioration (mirroir exact d'addWeapon) ────────────────────────

  it('ajoute une amélioration et notifie le parent via vehicleChanged (mirroir d\'addWeapon)', () => {
    const emitted: Vehicle[] = [];
    outputToObservable(component.vehicleChanged).subscribe((v) => emitted.push(v));
    vi.clearAllMocks();

    component.addImprovement({ nomInterne: 'blindage' });

    expect(mockVehicleService.addImprovement).toHaveBeenCalledExactlyOnceWith(100, { nomInterne: 'blindage' });
    expect(emitted).toEqual([mockVehicleWithImprovement]);
  });

  it('affiche la raison du refus si l\'ajout d\'une amélioration échoue', () => {
    mockVehicleService.addImprovement.mockReturnValue(
      throwError(() => new HttpErrorResponse({ error: { message: 'Une orientation est requise pour monter "Bélier"' }, status: 400 })),
    );

    component.addImprovement({ nomInterne: 'belier', orientation: undefined });

    expect(component.equipmentError()).toBe('Une orientation est requise pour monter "Bélier"');
  });

  // ── Section "Équipement actuel" — affichage et retrait (TOUJOURS proposé) ──

  it('affiche un message dédié dans chaque section quand le véhicule n\'a encore aucun équipement', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.em-current')?.textContent).toContain('Aucune arme montée');
    expect(el.querySelector('.em-current')?.textContent).toContain('Aucune amélioration installée');
    expect(el.querySelectorAll('.em-current__item')).toHaveLength(0);
  });

  it('affiche chaque arme et amélioration montée avec son orientation et un bouton de retrait', () => {
    fixture.componentRef.setInput('vehicle', {
      ...mockVehicle,
      weapons: mockVehicleWithWeapon.weapons,
      improvements: mockVehicleWithImprovement.improvements,
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.em-current__item');

    expect(items).toHaveLength(2);
    // Noms RÉSOLUS depuis le catalogue (pas le `nomInterne` brut) + orientation affichée
    expect(el.textContent).toContain('Mitrailleuse');
    expect(el.textContent).toContain('(avant)');
    expect(el.textContent).toContain('Blindage');
    expect(el.querySelectorAll('.em-current__remove')).toHaveLength(2);
  });

  it('removeWeapon() demande confirmation, retire l\'arme et notifie le parent avec le véhicule rechargé', () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    fixture.componentRef.setInput('vehicle', mockVehicleWithWeapon);
    fixture.detectChanges();
    mockVehicleService.getAllForTeam.mockReturnValue(of([mockVehicle])); // véhicule "nu" après retrait
    const emitted: Vehicle[] = [];
    outputToObservable(component.vehicleChanged).subscribe((v) => emitted.push(v));

    component.removeWeapon(mockVehicleWithWeapon.weapons[0]);

    expect(mockVehicleService.removeWeapon).toHaveBeenCalledExactlyOnceWith(200);
    // Retrait ⇒ 204 No Content : on recharge via getAllForTeam + .find() (cf. `reloadVehicle`)
    expect(mockVehicleService.getAllForTeam).toHaveBeenCalledWith(7);
    expect(emitted).toEqual([mockVehicle]);

    vi.unstubAllGlobals();
  });

  it('n\'appelle pas removeWeapon si l\'utilisateur annule la confirmation', () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
    fixture.componentRef.setInput('vehicle', mockVehicleWithWeapon);
    fixture.detectChanges();

    component.removeWeapon(mockVehicleWithWeapon.weapons[0]);

    expect(mockVehicleService.removeWeapon).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('affiche une erreur si le retrait d\'une arme échoue, sans recharger le véhicule', () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    fixture.componentRef.setInput('vehicle', mockVehicleWithWeapon);
    fixture.detectChanges();
    mockVehicleService.removeWeapon.mockReturnValue(
      throwError(() => new HttpErrorResponse({ error: { message: 'Erreur serveur' }, status: 500 })),
    );
    mockVehicleService.getAllForTeam.mockClear();

    component.removeWeapon(mockVehicleWithWeapon.weapons[0]);

    expect(component.equipmentError()).toBe('Erreur serveur');
    expect(mockVehicleService.getAllForTeam).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('removeImprovement() demande confirmation, retire l\'amélioration et notifie le parent (mirroir de removeWeapon)', () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    fixture.componentRef.setInput('vehicle', mockVehicleWithImprovement);
    fixture.detectChanges();
    mockVehicleService.getAllForTeam.mockReturnValue(of([mockVehicle]));
    const emitted: Vehicle[] = [];
    outputToObservable(component.vehicleChanged).subscribe((v) => emitted.push(v));

    component.removeImprovement(mockVehicleWithImprovement.improvements[0]);

    expect(mockVehicleService.removeImprovement).toHaveBeenCalledExactlyOnceWith(100, 300);
    expect(mockVehicleService.getAllForTeam).toHaveBeenCalledWith(7);
    expect(emitted).toEqual([mockVehicle]);

    vi.unstubAllGlobals();
  });

  // ── Détection "orientation requise" ─────────────────────────────────────────

  it('signale qu\'une orientation est requise pour une arme via le contrat textuel `raison` — mirroir exact d\'improvementNeedsOrientation', () => {
    // Correctif : la détection ne se base PLUS sur `option.type` mais sur `option.raison`,
    // mirroir de `improvementNeedsOrientation`. L'ancienne approche (type !== 'équipage')
    // traitait toujours les armes non-équipage comme "besoin d'orientation", même quand
    // le vrai refus était "emplacements insuffisants" — l'UI n'affichait jamais le grisage.
    expect(component.weaponNeedsOrientation({
      ...mockAvailableWeapon,
      disponible: false,
      raison: 'Une orientation est requise pour monter "Mitrailleuse" sur un arc de tir',
    })).toBe(true);
    expect(component.weaponNeedsOrientation({
      ...mockAvailableWeapon,
      disponible: false,
      raison: 'Emplacements insuffisants : 5/4 requis avec "Mitrailleuse"',
    })).toBe(false);
    // Arme disponible (raison undefined) → pas "besoin d'orientation" à signaler.
    expect(component.weaponNeedsOrientation(mockAvailableWeapon)).toBe(false);
  });

  it('signale qu\'une orientation est requise pour une amélioration via le contrat textuel `raison`', () => {
    expect(component.improvementNeedsOrientation({
      ...mockAvailableImprovement,
      disponible: false,
      raison: 'Une orientation est requise pour monter "Bélier" sur un arc de tir',
    })).toBe(true);
    expect(component.improvementNeedsOrientation({
      ...mockAvailableImprovement,
      disponible: false,
      raison: 'Emplacements insuffisants : 5/4 requis avec "Bélier"',
    })).toBe(false);
    expect(component.improvementNeedsOrientation(mockAvailableImprovement)).toBe(false);
  });

  // ── Résolution des noms affichés (nomInterne → nom du catalogue) ────────────

  it('résout le nom affiché d\'une arme/amélioration depuis le catalogue, avec repli sur le nomInterne', () => {
    expect(component.resolveWeaponName('mitrailleuse')).toBe('Mitrailleuse');
    expect(component.resolveWeaponName('inconnue')).toBe('inconnue');
    expect(component.resolveImprovementName('blindage')).toBe('Blindage');
    expect(component.resolveImprovementName('inconnue')).toBe('inconnue');
  });

  // ── Filtre "Afficher les indisponibles" ─────────────────────────────────────
  // `showUnavailable()` démarre à `false` : seules les options disponibles OU
  // nécessitant juste une orientation sont affichées. Les refus DÉFINITIFS
  // (sponsor/emplacements/règle de pose) sont masqués jusqu'au clic sur le bouton.

  describe('filtre des options indisponibles', () => {
    beforeEach(() => {
      mockVehicleService.getAvailableWeapons.mockReturnValue(of([mockAvailableWeapon, mockUnavailableWeapon, mockOrientableWeapon]));
      mockVehicleService.getAvailableImprovements.mockReturnValue(of([mockAvailableImprovement, mockUnavailableImprovement]));

      fixture = TestBed.createComponent(EquipmentManager);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('vehicle', mockVehicle);
      fixture.componentRef.setInput('sponsorCatalog', mockSponsorCatalog);
      fixture.componentRef.setInput('team', mockTeam);
      fixture.detectChanges();
    });

    it('masque par défaut les refus définitifs mais garde les options orientables visibles', () => {
      expect(component.showUnavailable()).toBe(false);

      // Disponible + orientable visibles, refus définitif masqué.
      expect(component.visibleWeapons()).toEqual([mockAvailableWeapon, mockOrientableWeapon]);
      expect(component.visibleImprovements()).toEqual([mockAvailableImprovement]);
    });

    it('compte les options masquées indépendamment de showUnavailable()', () => {
      expect(component.hiddenWeaponsCount()).toBe(1); // BFG
      expect(component.hiddenImprovementsCount()).toBe(1); // Nitro
      expect(component.hiddenCount()).toBe(2);
    });

    it('le bouton de filtre affiche le nombre d\'options masquées et les rend visibles au clic', () => {
      const el = fixture.nativeElement as HTMLElement;
      const toggle = el.querySelector('.em-toggle') as HTMLButtonElement;

      expect(toggle.textContent).toContain('Afficher les indisponibles (2)');
      expect(el.textContent).not.toContain('BFG');
      expect(el.textContent).not.toContain('Nitro');
      // L'option orientable, elle, reste visible même filtre actif.
      expect(el.textContent).toContain('Lance-Flammes');

      toggle.click();
      fixture.detectChanges();

      expect(component.showUnavailable()).toBe(true);
      expect(toggle.textContent).toContain('Masquer les indisponibles');
      expect(el.textContent).toContain('BFG');
      expect(el.textContent).toContain('Nitro');
    });
  });
});
