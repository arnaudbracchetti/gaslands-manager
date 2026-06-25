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
import { By } from '@angular/platform-browser';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { EquipmentManager } from './equipment-manager';
import { TeamBudget } from './team-budget/team-budget';
import { VehicleCostSummary } from './vehicle-cost-summary/vehicle-cost-summary';
import { MountedEquipment } from './mounted-equipment/mounted-equipment';
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
  regles: '',
  disponible: true,
};

const mockAvailableImprovement: AvailableImprovementDto = {
  nom: 'Blindage',
  nomInterne: 'blindage',
  prix: 4,
  emplacement: 1,
  description: '',
  regles: '',
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
  regles: '',
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
  regles: '',
  disponible: false,
  raison: 'Une orientation est requise pour monter "Lance-Flammes" sur un arc de tir',
};

const mockUnavailableImprovement: AvailableImprovementDto = {
  nom: 'Nitro',
  nomInterne: 'nitro',
  prix: 6,
  emplacement: 0,
  description: '',
  regles: '',
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
    unassignWeaponFromTourelle: ReturnType<typeof vi.fn>;
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
      unassignWeaponFromTourelle: vi.fn().mockReturnValue(of(mockVehicle)),
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

  // ── Budget de l'équipe (computed) — bloc "Budget de l'équipe" en tête de `.em-current__header` ──

  describe('Budget de l\'équipe (computed)', () => {
    // Véhicule "tiers" de la même équipe — nu (camion, prix catalogue 16),
    // utilisé pour peupler `coutAutresVehicules` via `getAllForTeam` + `buildVehicleSummary`.
    const mockOtherVehicle: Vehicle = {
      id: 101,
      nomInterne: 'camion',
      teamId: 7,
      improvements: [],
      weapons: [],
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    it('coutAutresVehicules exclut le véhicule courant et somme le coût des autres via buildVehicleSummary', () => {
      mockVehicleService.getAllForTeam.mockReturnValue(of([mockVehicle, mockOtherVehicle]));

      fixture = TestBed.createComponent(EquipmentManager);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('vehicle', mockVehicle);
      fixture.componentRef.setInput('sponsorCatalog', mockSponsorCatalog);
      fixture.componentRef.setInput('team', mockTeam);
      fixture.detectChanges();

      // mockVehicle (id 100, courant) exclu — seul mockOtherVehicle (16, camion nu) compte.
      expect(component.coutAutresVehicules()).toBe(16);
    });

    it('coutEquipeTotal additionne coutAutresVehicules et coutTotal du véhicule courant', () => {
      mockVehicleService.getAllForTeam.mockReturnValue(of([mockVehicle, mockOtherVehicle]));

      fixture = TestBed.createComponent(EquipmentManager);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('vehicle', mockVehicle);
      fixture.componentRef.setInput('sponsorCatalog', mockSponsorCatalog);
      fixture.componentRef.setInput('team', mockTeam);
      fixture.detectChanges();

      // coutAutresVehicules (16) + coutTotal du véhicule nu (16, prix catalogue du Camion)
      expect(component.coutEquipeTotal()).toBe(32);
    });

    it('budgetEquipe reflète Team.cans, budgetRestant = budget - coutEquipeTotal, budgetPourcentage arrondi', () => {
      mockVehicleService.getAllForTeam.mockReturnValue(of([mockVehicle, mockOtherVehicle]));

      fixture = TestBed.createComponent(EquipmentManager);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('vehicle', mockVehicle);
      fixture.componentRef.setInput('sponsorCatalog', mockSponsorCatalog);
      fixture.componentRef.setInput('team', mockTeam);
      fixture.detectChanges();

      expect(component.budgetEquipe()).toBe(50); // mockTeam.cans
      expect(component.budgetRestant()).toBe(18); // 50 - 32
      expect(component.budgetDepasse()).toBe(false);
      expect(component.budgetPourcentage()).toBe(64); // round(32/50*100)
    });

    it('budgetDepasse passe à true et budgetPourcentage est borné à 100% en cas de dépassement', () => {
      const mockTeamLowBudget: Team = { ...mockTeam, cans: 30 };
      mockVehicleService.getAllForTeam.mockReturnValue(of([mockVehicle, mockOtherVehicle]));

      fixture = TestBed.createComponent(EquipmentManager);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('vehicle', mockVehicle);
      fixture.componentRef.setInput('sponsorCatalog', mockSponsorCatalog);
      fixture.componentRef.setInput('team', mockTeamLowBudget);
      fixture.detectChanges();

      // coutEquipeTotal = 32, budget = 30 → dépassement de 2
      expect(component.budgetRestant()).toBe(-2);
      expect(component.budgetDepasse()).toBe(true);
      expect(component.budgetPourcentage()).toBe(100); // round(32/30*100) = 107 → borné à 100
    });

    it('coutAutresVehicules retombe à 0 en cas d\'échec de getAllForTeam (purement informatif, ne bloque rien)', () => {
      mockVehicleService.getAllForTeam.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

      fixture = TestBed.createComponent(EquipmentManager);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('vehicle', mockVehicle);
      fixture.componentRef.setInput('sponsorCatalog', mockSponsorCatalog);
      fixture.componentRef.setInput('team', mockTeam);
      fixture.detectChanges();

      expect(component.coutAutresVehicules()).toBe(0);
      // Échec purement informatif — ne déclenche PAS le même message d'erreur que
      // `loadAvailableEquipment` (cf. `loadCoutAutresVehicules`, "échec silencieux").
      expect(component.equipmentError()).toBe('');
    });
  });

  // ── Câblage des 3 sous-composants extraits — mirroir de vehicle-configurator.spec.ts ──
  // Le DOM/contenu de chaque bloc est désormais testé dans son propre `.spec.ts`
  // (team-budget, vehicle-cost-summary, mounted-equipment) — ici on vérifie
  // uniquement que `EquipmentManager` leur transmet les bonnes valeurs/références
  // et réagit correctement à leurs outputs.

  describe('Câblage vers TeamBudget', () => {
    it('transmet les 5 valeurs computed du budget', () => {
      const teamBudget = fixture.debugElement.query(By.directive(TeamBudget)).componentInstance as TeamBudget;

      expect(teamBudget.budgetEquipe()).toBe(component.budgetEquipe());
      expect(teamBudget.coutEquipeTotal()).toBe(component.coutEquipeTotal());
      expect(teamBudget.budgetRestant()).toBe(component.budgetRestant());
      expect(teamBudget.budgetDepasse()).toBe(component.budgetDepasse());
      expect(teamBudget.budgetPourcentage()).toBe(component.budgetPourcentage());
    });
  });

  describe('Câblage vers VehicleCostSummary', () => {
    it('transmet le nom du véhicule, les emplacements et le détail du coût', () => {
      const summary = fixture.debugElement.query(By.directive(VehicleCostSummary)).componentInstance as VehicleCostSummary;

      expect(summary.vehicleName()).toBe('Camion'); // chosenVehicule()?.nom
      expect(summary.emplacementsUtilises()).toBe(component.emplacementsUtilises());
      expect(summary.emplacementsTotal()).toBe(component.emplacementsTotal());
      expect(summary.coutBase()).toBe(component.coutBase());
      expect(summary.coutEquipement()).toBe(component.coutEquipement());
      expect(summary.coutTotal()).toBe(component.coutTotal());
    });

    it('retombe sur `vehicle().nomInterne` si le véhicule est introuvable dans le catalogue (chosenVehicule null)', () => {
      fixture.componentRef.setInput('vehicle', { ...mockVehicle, nomInterne: 'inconnu' });
      fixture.detectChanges();

      const summary = fixture.debugElement.query(By.directive(VehicleCostSummary)).componentInstance as VehicleCostSummary;
      expect(summary.vehicleName()).toBe('inconnu');
    });
  });

  describe('Câblage vers MountedEquipment', () => {
    it('transmet les armes/améliorations montées et le catalogue du sponsor', () => {
      fixture.componentRef.setInput('vehicle', {
        ...mockVehicle,
        weapons: mockVehicleWithWeapon.weapons,
        improvements: mockVehicleWithImprovement.improvements,
      });
      fixture.detectChanges();

      const mounted = fixture.debugElement.query(By.directive(MountedEquipment)).componentInstance as MountedEquipment;

      expect(mounted.weapons()).toEqual(mockVehicleWithWeapon.weapons);
      expect(mounted.improvements()).toEqual(mockVehicleWithImprovement.improvements);
      expect(mounted.sponsorCatalog()).toEqual(mockSponsorCatalog);
    });

    it('weaponRemoved → removeWeapon (ouvre la modale de confirmation)', () => {
      fixture.componentRef.setInput('vehicle', mockVehicleWithWeapon);
      fixture.detectChanges();
      mockVehicleService.getAllForTeam.mockReturnValue(of([mockVehicle]));

      const mounted = fixture.debugElement.query(By.directive(MountedEquipment)).componentInstance as MountedEquipment;
      mounted.weaponRemoved.emit(mockVehicleWithWeapon.weapons[0]);

      // removeWeapon positionne le signal, la modale attend la confirmation
      expect(component.pendingRemoveWeapon()).toEqual(mockVehicleWithWeapon.weapons[0]);
      expect(mockVehicleService.removeWeapon).not.toHaveBeenCalled();

      // Simulation du clic "Confirmer"
      component.onConfirmRemoveWeapon();
      expect(mockVehicleService.removeWeapon).toHaveBeenCalledExactlyOnceWith(200);
    });

    it('improvementRemoved → removeImprovement (ouvre la modale de confirmation)', () => {
      fixture.componentRef.setInput('vehicle', mockVehicleWithImprovement);
      fixture.detectChanges();
      mockVehicleService.getAllForTeam.mockReturnValue(of([mockVehicle]));

      const mounted = fixture.debugElement.query(By.directive(MountedEquipment)).componentInstance as MountedEquipment;
      mounted.improvementRemoved.emit(mockVehicleWithImprovement.improvements[0]);

      expect(component.pendingRemoveImprovement()).toEqual(mockVehicleWithImprovement.improvements[0]);
      expect(mockVehicleService.removeImprovement).not.toHaveBeenCalled();

      component.onConfirmRemoveImprovement();
      expect(mockVehicleService.removeImprovement).toHaveBeenCalledExactlyOnceWith(100, 300);
    });

    it('tourelleAssignRequested → openAssignModal (ouvre la modale d\'assignation)', () => {
      const tourelle: Vehicle['improvements'][number] = {
        id: 301, nomInterne: 'tourelle', orientation: null, vehicleId: 100,
        createdAt: '2026-01-01T00:00:03.000Z', estDefaut: false, prix: 0, emplacement: 0, weaponNomInterne: null,
      };
      fixture.componentRef.setInput('vehicle', { ...mockVehicle, improvements: [tourelle] });
      fixture.detectChanges();

      const mounted = fixture.debugElement.query(By.directive(MountedEquipment)).componentInstance as MountedEquipment;
      mounted.tourelleAssignRequested.emit(tourelle);

      expect(component.selectedOrphanTourelle()).toEqual(tourelle);
    });

    it('tourelleUnassignRequested → unassignWeaponFromTourelle', () => {
      const tourelleAssignee: Vehicle['improvements'][number] = {
        id: 301, nomInterne: 'tourelle', orientation: 'avant', vehicleId: 100,
        createdAt: '2026-01-01T00:00:03.000Z', estDefaut: false, prix: 12, emplacement: 0, weaponNomInterne: 'mitrailleuse',
      };
      fixture.componentRef.setInput('vehicle', { ...mockVehicle, improvements: [tourelleAssignee] });
      fixture.detectChanges();

      const mounted = fixture.debugElement.query(By.directive(MountedEquipment)).componentInstance as MountedEquipment;
      mounted.tourelleUnassignRequested.emit(tourelleAssignee);

      expect(mockVehicleService.unassignWeaponFromTourelle).toHaveBeenCalledExactlyOnceWith(100, 301);
    });
  });

  // ── Filtre budget de armesPourTourelle (armes hors budget masquées) ─────────

  describe('armesPourTourelle (filtre budget)', () => {
    // Sponsor avec deux armes : une bon marché (×3 = 12) et une chère (×3 = 60).
    const catalogueAvecArmeChere: Sponsor = {
      ...mockSponsorCatalog,
      armes: [
        { nom: 'Mitrailleuse', nom_interne: 'mitrailleuse', type: 'base', prix: 4, emplacement: 1, description: '', regles: '', sponsors_autorises: ['Rutherford'] },
        { nom: 'BFG', nom_interne: 'bfg', type: 'avancée', prix: 20, emplacement: 1, description: '', regles: '', sponsors_autorises: ['Rutherford'] },
      ],
    };

    const tourelleOrpheline: Vehicle['improvements'][number] = {
      id: 301, nomInterne: 'tourelle', orientation: null, vehicleId: 100,
      createdAt: '2026-01-01T00:00:03.000Z', estDefaut: false, prix: 0, emplacement: 0, weaponNomInterne: null,
    };

    function setup(cans: number, vehicle: Vehicle = { ...mockVehicle, improvements: [tourelleOrpheline] }): void {
      fixture = TestBed.createComponent(EquipmentManager);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('vehicle', vehicle);
      fixture.componentRef.setInput('sponsorCatalog', catalogueAvecArmeChere);
      fixture.componentRef.setInput('team', { ...mockTeam, cans });
      fixture.detectChanges();
      // Sélectionner la Tourelle orpheline → arme cibles = armesPourTourelle.
      component.selectedOrphanTourelle.set(vehicle.improvements[0]);
    }

    it('exclut une arme dont le coût ×3 dépasse le budget disponible', () => {
      // getAllForTeam (mock) ajoute le coût d'un autre véhicule (16). Véhicule
      // courant nu = 16. Budget 50 → restant = 50 - 32 = 18. BFG ×3 = 60 > 18 → exclue.
      setup(50);
      const noms = component.armesPourTourelle().map((a): string => a.nom_interne);
      expect(noms).toContain('mitrailleuse'); // 12 ≤ 18
      expect(noms).not.toContain('bfg'); // 60 > 18
    });

    it('inclut une arme finançable', () => {
      // Budget large : 100 → restant = 100 - 32 = 68. BFG ×3 = 60 ≤ 68 → incluse.
      setup(100);
      const noms = component.armesPourTourelle().map((a): string => a.nom_interne);
      expect(noms).toContain('bfg');
    });

    it('en ré-assignation, « rend » le coût de l\'arme actuellement montée', () => {
      // Tourelle déjà montée avec BFG (coût ×3 = 60). Véhicule courant = 16 + 60 = 76,
      // + 16 (autre véhicule) = 92. Budget 100 → restant = 8. Sans reprise, la BFG
      // (60) serait exclue ; mais on rend son coût (60) → 68 dispo → BFG reste proposée.
      const tourelleBfg: Vehicle['improvements'][number] = {
        ...tourelleOrpheline, prix: 60, weaponNomInterne: 'bfg',
      };
      setup(100, { ...mockVehicle, improvements: [tourelleBfg] });
      const noms = component.armesPourTourelle().map((a): string => a.nom_interne);
      expect(noms).toContain('bfg');
    });
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

  // ── Retrait d'équipement (TOUJOURS proposé) — logique métier, appelée depuis
  // les outputs de `MountedEquipment` (cf. "Câblage vers MountedEquipment" ci-dessus) ──

  it('removeWeapon() ouvre la modale puis, à confirmation, retire l\'arme et notifie le parent avec le véhicule rechargé', () => {
    fixture.componentRef.setInput('vehicle', mockVehicleWithWeapon);
    fixture.detectChanges();
    mockVehicleService.getAllForTeam.mockReturnValue(of([mockVehicle])); // véhicule "nu" après retrait
    const emitted: Vehicle[] = [];
    outputToObservable(component.vehicleChanged).subscribe((v) => emitted.push(v));

    component.removeWeapon(mockVehicleWithWeapon.weapons[0]);
    expect(component.pendingRemoveWeapon()).toEqual(mockVehicleWithWeapon.weapons[0]);
    expect(mockVehicleService.removeWeapon).not.toHaveBeenCalled();

    component.onConfirmRemoveWeapon();

    expect(mockVehicleService.removeWeapon).toHaveBeenCalledExactlyOnceWith(200);
    // Retrait ⇒ 204 No Content : on recharge via getAllForTeam + .find() (cf. `reloadVehicle`)
    expect(mockVehicleService.getAllForTeam).toHaveBeenCalledWith(7);
    expect(emitted).toEqual([mockVehicle]);
    expect(component.pendingRemoveWeapon()).toBeNull();
  });

  it('n\'appelle pas removeWeapon si l\'utilisateur annule la confirmation', () => {
    fixture.componentRef.setInput('vehicle', mockVehicleWithWeapon);
    fixture.detectChanges();

    component.removeWeapon(mockVehicleWithWeapon.weapons[0]);
    expect(component.pendingRemoveWeapon()).toEqual(mockVehicleWithWeapon.weapons[0]);

    // Simulation du clic "Annuler"
    component.pendingRemoveWeapon.set(null);

    expect(mockVehicleService.removeWeapon).not.toHaveBeenCalled();
  });

  it('affiche une erreur si le retrait d\'une arme échoue, sans recharger le véhicule', () => {
    fixture.componentRef.setInput('vehicle', mockVehicleWithWeapon);
    fixture.detectChanges();
    mockVehicleService.removeWeapon.mockReturnValue(
      throwError(() => new HttpErrorResponse({ error: { message: 'Erreur serveur' }, status: 500 })),
    );
    mockVehicleService.getAllForTeam.mockClear();

    component.removeWeapon(mockVehicleWithWeapon.weapons[0]);
    component.onConfirmRemoveWeapon();

    expect(component.equipmentError()).toBe('Erreur serveur');
    expect(mockVehicleService.getAllForTeam).not.toHaveBeenCalled();
  });

  it('removeImprovement() ouvre la modale puis, à confirmation, retire l\'amélioration et notifie le parent (mirroir de removeWeapon)', () => {
    fixture.componentRef.setInput('vehicle', mockVehicleWithImprovement);
    fixture.detectChanges();
    mockVehicleService.getAllForTeam.mockReturnValue(of([mockVehicle]));
    const emitted: Vehicle[] = [];
    outputToObservable(component.vehicleChanged).subscribe((v) => emitted.push(v));

    component.removeImprovement(mockVehicleWithImprovement.improvements[0]);
    expect(component.pendingRemoveImprovement()).toEqual(mockVehicleWithImprovement.improvements[0]);
    expect(mockVehicleService.removeImprovement).not.toHaveBeenCalled();

    component.onConfirmRemoveImprovement();

    expect(mockVehicleService.removeImprovement).toHaveBeenCalledExactlyOnceWith(100, 300);
    expect(mockVehicleService.getAllForTeam).toHaveBeenCalledWith(7);
    expect(emitted).toEqual([mockVehicle]);
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
