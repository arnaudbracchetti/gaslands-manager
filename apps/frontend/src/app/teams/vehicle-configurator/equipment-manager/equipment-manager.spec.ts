/**
 * Tests unitaires pour EquipmentManager — composant "smart" PARTAGÉ de gestion
 * de l'équipement d'un véhicule (cf. son en-tête).
 *
 * Depuis F1–F5, le composant ne parle plus à `VehicleService` en dur mais à une
 * `EquipmentDataSource` INJECTÉE (token `EQUIPMENT_DATA_SOURCE`), et reçoit son
 * budget en `input` (`BudgetView`, calculé par le parent) au lieu de lire `team.cans`
 * + `getAllForTeam`. Ces tests pilotent donc un mock de la source de données et
 * fournissent le budget directement — la logique interne (emplacements, coûts,
 * filtres, orientation) est inchangée.
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
import { EQUIPMENT_DATA_SOURCE, BudgetView } from '../equipment-data-source';
import { Sponsor, Vehicule } from '../../../catalog/catalog.model';
import { AvailableImprovementDto, AvailableWeaponDto, Vehicle } from '../vehicle-builder.model';

// ── Données fictives ──────────────────────────────────────────────────────────

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

// Budget par défaut : total 50, rien consommé ailleurs (usedByOthers 0).
const defaultBudget: BudgetView = { total: 50, usedByOthers: 0 };

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
  weapons: [{ id: 200, nomInterne: 'mitrailleuse', orientation: 'avant', vehicleId: 100, createdAt: '2026-01-01T00:00:01.000Z', prix: 4, estDefaut: false }],
};

// Véhicule équipé d'une amélioration — sert au mirroir `removeImprovement`/`addImprovement`.
const mockVehicleWithImprovement: Vehicle = {
  ...mockVehicle,
  improvements: [{ id: 300, nomInterne: 'blindage', orientation: null, vehicleId: 100, createdAt: '2026-01-01T00:00:02.000Z', estDefaut: false, prix: 4, emplacement: 1 }],
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
  montableSurTourelle: false,
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
  montableSurTourelle: false,
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
  montableSurTourelle: false,
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
  let mockDataSource: {
    getAvailableWeapons: ReturnType<typeof vi.fn>;
    getAvailableImprovements: ReturnType<typeof vi.fn>;
    addWeapon: ReturnType<typeof vi.fn>;
    addImprovement: ReturnType<typeof vi.fn>;
    removeWeapon: ReturnType<typeof vi.fn>;
    removeImprovement: ReturnType<typeof vi.fn>;
  };

  /** Instancie le composant avec un budget donné (défaut : `defaultBudget`). */
  function createWith(vehicle: Vehicle, budget: BudgetView = defaultBudget, catalog: Sponsor = mockSponsorCatalog): void {
    fixture = TestBed.createComponent(EquipmentManager);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('vehicle', vehicle);
    fixture.componentRef.setInput('sponsorCatalog', catalog);
    fixture.componentRef.setInput('budget', budget);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    mockDataSource = {
      getAvailableWeapons: vi.fn().mockReturnValue(of([mockAvailableWeapon])),
      getAvailableImprovements: vi.fn().mockReturnValue(of([mockAvailableImprovement])),
      addWeapon: vi.fn().mockReturnValue(of(mockVehicleWithWeapon)),
      addImprovement: vi.fn().mockReturnValue(of(mockVehicleWithImprovement)),
      removeWeapon: vi.fn().mockReturnValue(of(mockVehicle)),
      removeImprovement: vi.fn().mockReturnValue(of(mockVehicle)),
    };

    await TestBed.configureTestingModule({
      imports: [EquipmentManager],
      providers: [{ provide: EQUIPMENT_DATA_SOURCE, useValue: mockDataSource }],
    }).compileComponents();

    createWith(mockVehicle);
  });

  afterEach(() => vi.clearAllMocks());

  // ── Chargement et affichage de l'équipement disponible ─────────────────────

  it('charge les équipements disponibles au premier rendu (effect → loadAvailableEquipment)', () => {
    expect(mockDataSource.getAvailableWeapons).toHaveBeenCalledExactlyOnceWith(100);
    expect(mockDataSource.getAvailableImprovements).toHaveBeenCalledExactlyOnceWith(100);
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
    mockDataSource.getAvailableWeapons.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

    createWith(mockVehicle);

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

  it('exclut une arme vendue (atelier) du calcul des emplacements — l\'emplacement est libéré', () => {
    fixture.componentRef.setInput('vehicle', {
      ...mockVehicle,
      weapons: [{ ...mockVehicleWithWeapon.weapons[0], sold: true }],
    });
    fixture.detectChanges();

    expect(component.emplacementsUtilises()).toBe(0);
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

  // ── Budget (computed depuis l'input `budget` : { total, usedByOthers }) ──────

  describe('Budget (input BudgetView)', () => {
    it('budgetEquipe = budget.total ; coutEquipeTotal = usedByOthers + coutTotal du véhicule courant', () => {
      // usedByOthers 16 (un autre véhicule "camion" nu), véhicule courant nu (16).
      createWith(mockVehicle, { total: 50, usedByOthers: 16 });

      expect(component.budgetEquipe()).toBe(50);
      expect(component.coutEquipeTotal()).toBe(32); // 16 + 16
    });

    it('budgetRestant = total - coutEquipeTotal, budgetPourcentage arrondi', () => {
      createWith(mockVehicle, { total: 50, usedByOthers: 16 });

      expect(component.budgetRestant()).toBe(18); // 50 - 32
      expect(component.budgetDepasse()).toBe(false);
      expect(component.budgetPourcentage()).toBe(64); // round(32/50*100)
    });

    it('budgetDepasse passe à true et budgetPourcentage est borné à 100% en cas de dépassement', () => {
      // total 30, coutEquipeTotal 32 → dépassement de 2.
      createWith(mockVehicle, { total: 30, usedByOthers: 16 });

      expect(component.budgetRestant()).toBe(-2);
      expect(component.budgetDepasse()).toBe(true);
      expect(component.budgetPourcentage()).toBe(100); // round(32/30*100) = 107 → borné à 100
    });
  });

  // ── Câblage des 3 sous-composants extraits ──────────────────────────────────

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

      const mounted = fixture.debugElement.query(By.directive(MountedEquipment)).componentInstance as MountedEquipment;
      mounted.weaponRemoved.emit(mockVehicleWithWeapon.weapons[0]);

      // removeWeapon positionne le signal, la modale attend la confirmation
      expect(component.pendingRemoveWeapon()).toEqual(mockVehicleWithWeapon.weapons[0]);
      expect(mockDataSource.removeWeapon).not.toHaveBeenCalled();

      // Simulation du clic "Confirmer"
      component.onConfirmRemoveWeapon();
      expect(mockDataSource.removeWeapon).toHaveBeenCalledExactlyOnceWith(100, 200);
    });

    it('improvementRemoved → removeImprovement (ouvre la modale de confirmation)', () => {
      fixture.componentRef.setInput('vehicle', mockVehicleWithImprovement);
      fixture.detectChanges();

      const mounted = fixture.debugElement.query(By.directive(MountedEquipment)).componentInstance as MountedEquipment;
      mounted.improvementRemoved.emit(mockVehicleWithImprovement.improvements[0]);

      expect(component.pendingRemoveImprovement()).toEqual(mockVehicleWithImprovement.improvements[0]);
      expect(mockDataSource.removeImprovement).not.toHaveBeenCalled();

      component.onConfirmRemoveImprovement();
      expect(mockDataSource.removeImprovement).toHaveBeenCalledExactlyOnceWith(100, 300);
    });
  });

  // ── Ajout d'arme ────────────────────────────────────────────────────────────

  it('ajoute une arme et notifie le parent via vehicleChanged avec l\'entité mise à jour', () => {
    const emitted: Vehicle[] = [];
    outputToObservable(component.vehicleChanged).subscribe((v) => emitted.push(v));
    vi.clearAllMocks(); // ne compter que les appels déclenchés par addWeapon

    component.addWeapon({ nomInterne: 'mitrailleuse', orientation: 'avant' });

    expect(mockDataSource.addWeapon).toHaveBeenCalledExactlyOnceWith(100, { nomInterne: 'mitrailleuse', orientation: 'avant' });
    expect(emitted).toEqual([mockVehicleWithWeapon]);
  });

  it('ajoute une arme avec orientation \'tourelle\' et transmet le choix tel quel au data source', () => {
    component.addWeapon({ nomInterne: 'bfg', orientation: 'tourelle' });

    expect(mockDataSource.addWeapon).toHaveBeenCalledWith(100, { nomInterne: 'bfg', orientation: 'tourelle' });
  });

  it('recharge automatiquement les verdicts de disponibilité après un ajout réussi (via l\'effect réagissant à `vehicle`)', () => {
    fixture.componentRef.setInput('vehicle', mockVehicleWithWeapon);
    fixture.detectChanges();

    // Le composant ne déclenche PAS lui-même de rechargement : c'est l'`effect()`
    // du constructeur, réagissant au nouvel input `vehicle`, qui s'en charge.
    expect(mockDataSource.getAvailableWeapons).toHaveBeenCalledWith(100);
    expect(mockDataSource.getAvailableImprovements).toHaveBeenCalledWith(100);
  });

  it('affiche la raison du refus si l\'ajout d\'une arme échoue, sans émettre vehicleChanged', () => {
    mockDataSource.addWeapon.mockReturnValue(
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

    expect(mockDataSource.addImprovement).toHaveBeenCalledExactlyOnceWith(100, { nomInterne: 'blindage' });
    expect(emitted).toEqual([mockVehicleWithImprovement]);
  });

  it('affiche la raison du refus si l\'ajout d\'une amélioration échoue', () => {
    mockDataSource.addImprovement.mockReturnValue(
      throwError(() => new HttpErrorResponse({ error: { message: 'Une orientation est requise pour monter "Bélier"' }, status: 400 })),
    );

    component.addImprovement({ nomInterne: 'belier', orientation: undefined });

    expect(component.equipmentError()).toBe('Une orientation est requise pour monter "Bélier"');
  });

  // ── Retrait d'équipement (TOUJOURS proposé) — le datasource renvoie le véhicule ──

  it('removeWeapon() ouvre la modale puis, à confirmation, retire l\'arme et notifie le parent avec le véhicule renvoyé', () => {
    fixture.componentRef.setInput('vehicle', mockVehicleWithWeapon);
    fixture.detectChanges();
    const emitted: Vehicle[] = [];
    outputToObservable(component.vehicleChanged).subscribe((v) => emitted.push(v));

    component.removeWeapon(mockVehicleWithWeapon.weapons[0]);
    expect(component.pendingRemoveWeapon()).toEqual(mockVehicleWithWeapon.weapons[0]);
    expect(mockDataSource.removeWeapon).not.toHaveBeenCalled();

    component.onConfirmRemoveWeapon();

    expect(mockDataSource.removeWeapon).toHaveBeenCalledExactlyOnceWith(100, 200);
    // Le datasource renvoie directement le véhicule mis à jour — émis tel quel.
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

    expect(mockDataSource.removeWeapon).not.toHaveBeenCalled();
  });

  it('affiche une erreur si le retrait d\'une arme échoue, sans émettre vehicleChanged', () => {
    fixture.componentRef.setInput('vehicle', mockVehicleWithWeapon);
    fixture.detectChanges();
    mockDataSource.removeWeapon.mockReturnValue(
      throwError(() => new HttpErrorResponse({ error: { message: 'Erreur serveur' }, status: 500 })),
    );
    const emitted: Vehicle[] = [];
    outputToObservable(component.vehicleChanged).subscribe((v) => emitted.push(v));

    component.removeWeapon(mockVehicleWithWeapon.weapons[0]);
    component.onConfirmRemoveWeapon();

    expect(component.equipmentError()).toBe('Erreur serveur');
    expect(emitted).toHaveLength(0);
  });

  it('removeImprovement() ouvre la modale puis, à confirmation, retire l\'amélioration et notifie le parent (mirroir de removeWeapon)', () => {
    fixture.componentRef.setInput('vehicle', mockVehicleWithImprovement);
    fixture.detectChanges();
    const emitted: Vehicle[] = [];
    outputToObservable(component.vehicleChanged).subscribe((v) => emitted.push(v));

    component.removeImprovement(mockVehicleWithImprovement.improvements[0]);
    expect(component.pendingRemoveImprovement()).toEqual(mockVehicleWithImprovement.improvements[0]);
    expect(mockDataSource.removeImprovement).not.toHaveBeenCalled();

    component.onConfirmRemoveImprovement();

    expect(mockDataSource.removeImprovement).toHaveBeenCalledExactlyOnceWith(100, 300);
    expect(emitted).toEqual([mockVehicle]);
  });

  // ── Texte de confirmation de retrait — annulation vs revente (atelier) ──────

  describe('weaponRemovalMessage / improvementRemovalMessage', () => {
    it('propose "Revendre" avec le montant à moitié prix (floor) quand l\'objet est pré-existant', () => {
      const weapon = mockVehicleWithWeapon.weapons[0]; // prix 4, purchasedThisSession absent
      expect(component.weaponRemovalMessage(weapon)).toBe('Revendre "Mitrailleuse" pour 2 jerricans (50%) ?');
      expect(component.weaponRemovalConfirmLabel()).toBe('Retirer');
    });

    it('propose "Annuler l\'achat" sans montant quand l\'objet a été acheté cette session', () => {
      const weapon = { ...mockVehicleWithWeapon.weapons[0], purchasedThisSession: true };
      expect(component.weaponRemovalMessage(weapon)).toBe('Annuler l\'achat de "Mitrailleuse" ?');
      expect(component.weaponRemovalConfirmLabel()).toBe('Retirer');
    });

    it('mirroir exact pour les améliorations', () => {
      const improvement = mockVehicleWithImprovement.improvements[0]; // prix 4
      expect(component.improvementRemovalMessage(improvement)).toBe('Revendre "Blindage" pour 2 jerricans (50%) ?');
      expect(component.improvementRemovalConfirmLabel()).toBe('Retirer');

      const purchasedThisSession = { ...improvement, purchasedThisSession: true };
      expect(component.improvementRemovalMessage(purchasedThisSession)).toBe('Annuler l\'achat de "Blindage" ?');
      expect(component.improvementRemovalConfirmLabel()).toBe('Retirer');
    });
  });

  // ── Détection "orientation requise" ─────────────────────────────────────────

  it('signale qu\'une orientation est requise pour une arme via le contrat textuel `raison` — mirroir exact d\'improvementNeedsOrientation', () => {
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

  describe('filtre des options indisponibles', () => {
    beforeEach(() => {
      mockDataSource.getAvailableWeapons.mockReturnValue(of([mockAvailableWeapon, mockUnavailableWeapon, mockOrientableWeapon]));
      mockDataSource.getAvailableImprovements.mockReturnValue(of([mockAvailableImprovement, mockUnavailableImprovement]));

      createWith(mockVehicle);
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
