/**
 * Tests unitaires pour VehicleBuilder.
 *
 * Mirroir de `teams.spec.ts` (cf. son en-tête) : composant "smart", on teste
 * son rôle d'orchestration — PAS l'affichage interne de ses sous-composants
 * dumb (`VehicleChoiceCard`, `EquipmentOption`, déjà couverts par leurs propres
 * specs). Comme `Teams` y appelle directement `openCreate()`/`deleteTeam()`,
 * on appelle ici directement `selectVehicle()`/`addWeapon()`/`finish()` plutôt
 * que de simuler des clics à travers plusieurs niveaux de composants projetés.
 *
 * `CatalogService` et `VehicleService` sont mockés (façades HTTP pures, cf.
 * leur en-tête respectif) — même approche que `mockCatalogService` dans
 * `team-form.spec.ts` : on substitue des `Observable` connus via `of`/`throwError`.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { VehicleBuilder } from './vehicle-builder';
import { CatalogService } from '../../catalog/catalog.service';
import { VehicleService } from './vehicle.service';
import { Sponsor, Vehicule } from '../../catalog/catalog.model';
import { Team } from '../team.model';
import { AvailableImprovementDto, AvailableWeaponDto, Vehicle } from './vehicle-builder.model';

// ── Données fictives ──────────────────────────────────────────────────────────

const mockTeam: Team = {
  id: 7,
  name: 'Les Furieux du Désert',
  sponsor: 'Rutherford',
  cans: 50,
  userId: 42,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  vehicleCount: 0,
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

// Catalogue complet du sponsor — alimente les DEUX étapes du builder
// (cf. `Sponsor`, doc : "vehicules" pour l'étape 1, "armes"/"ameliorations" pour l'étape 2).
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

// Véhicule "nu" retourné par `vehicleService.create` — entité brute, pas encore équipée
// (cf. `Vehicle`, doc : `improvements`/`weapons` vides tant que rien n'est monté).
const mockCreatedVehicle: Vehicle = {
  id: 100,
  nomInterne: 'camion',
  teamId: 7,
  improvements: [],
  weapons: [],
  createdAt: '2026-01-01T00:00:00.000Z',
};

// Véhicule rechargé après l'ajout d'une arme — utilisé pour vérifier le recalcul
// des emplacements consommés (cf. `emplacementsUtilises`, doc).
const mockVehicleWithWeapon: Vehicle = {
  ...mockCreatedVehicle,
  weapons: [{ id: 200, nomInterne: 'mitrailleuse', orientation: 'avant', vehicleId: 100, createdAt: '2026-01-01T00:00:01.000Z' }],
};

const mockAvailableWeapon: AvailableWeaponDto = {
  nom: 'Mitrailleuse',
  nomInterne: 'mitrailleuse',
  prix: 4,
  emplacement: 1,
  type: 'base',
  disponible: true,
};

const mockAvailableImprovement: AvailableImprovementDto = {
  nom: 'Blindage',
  nomInterne: 'blindage',
  prix: 4,
  emplacement: 1,
  disponible: true,
};

describe('VehicleBuilder', () => {
  let component: VehicleBuilder;
  let fixture: ComponentFixture<VehicleBuilder>;
  let mockCatalogService: { getSponsorByName: ReturnType<typeof vi.fn> };
  let mockVehicleService: {
    create: ReturnType<typeof vi.fn>;
    getAvailableWeapons: ReturnType<typeof vi.fn>;
    getAvailableImprovements: ReturnType<typeof vi.fn>;
    addWeapon: ReturnType<typeof vi.fn>;
    addImprovement: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockCatalogService = {
      getSponsorByName: vi.fn().mockReturnValue(of(mockSponsorCatalog)),
    };
    mockVehicleService = {
      create: vi.fn().mockReturnValue(of(mockCreatedVehicle)),
      getAvailableWeapons: vi.fn().mockReturnValue(of([mockAvailableWeapon])),
      getAvailableImprovements: vi.fn().mockReturnValue(of([mockAvailableImprovement])),
      addWeapon: vi.fn().mockReturnValue(of(mockVehicleWithWeapon)),
      addImprovement: vi.fn().mockReturnValue(of(mockVehicleWithWeapon)),
    };

    await TestBed.configureTestingModule({
      imports: [VehicleBuilder],
      providers: [
        { provide: CatalogService, useValue: mockCatalogService },
        { provide: VehicleService, useValue: mockVehicleService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VehicleBuilder);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('team', mockTeam);
    // detectChanges() déclenche ngOnInit → charge le catalogue du sponsor
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  // ── Chargement du catalogue ─────────────────────────────────────────────────

  it('charge le catalogue du sponsor de l\'équipe au démarrage', () => {
    expect(mockCatalogService.getSponsorByName).toHaveBeenCalledExactlyOnceWith('Rutherford');
    expect(component.sponsorCatalog()).toEqual(mockSponsorCatalog);
    expect(component.loadingCatalog()).toBe(false);
  });

  it('affiche un message d\'erreur si le chargement du catalogue échoue', () => {
    mockCatalogService.getSponsorByName.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

    fixture = TestBed.createComponent(VehicleBuilder);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('team', mockTeam);
    fixture.detectChanges();

    expect(component.catalogError()).not.toBe('');
    expect(component.loadingCatalog()).toBe(false);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.vb-status--error')?.textContent).toContain('catalogue');
  });

  // ── Étape 1 : affichage et choix du véhicule ────────────────────────────────

  it('affiche une carte par véhicule autorisé par le sponsor en étape 1', () => {
    const el = fixture.nativeElement as HTMLElement;
    const cards = el.querySelectorAll('app-vehicle-choice-card');

    expect(component.step()).toBe(1);
    expect(cards).toHaveLength(1);
    expect(el.textContent).toContain('Camion');
  });

  it('crée le véhicule, passe à l\'étape 2 et charge ses équipements au choix d\'un véhicule', () => {
    component.selectVehicle(mockVehicule);
    fixture.detectChanges();

    expect(mockVehicleService.create).toHaveBeenCalledExactlyOnceWith(7, { nomInterne: 'camion' });
    expect(component.createdVehicle()).toEqual(mockCreatedVehicle);
    expect(component.step()).toBe(2);
    expect(mockVehicleService.getAvailableWeapons).toHaveBeenCalledExactlyOnceWith(100);
    expect(mockVehicleService.getAvailableImprovements).toHaveBeenCalledExactlyOnceWith(100);
    expect(component.availableWeapons()).toEqual([mockAvailableWeapon]);
    expect(component.availableImprovements()).toEqual([mockAvailableImprovement]);
  });

  it('affiche une erreur et reste en étape 1 si la création du véhicule échoue', () => {
    mockVehicleService.create.mockReturnValue(
      throwError(() => new HttpErrorResponse({ error: { message: 'Ce véhicule n\'est pas autorisé pour ce sponsor' }, status: 400 })),
    );

    component.selectVehicle(mockVehicule);
    fixture.detectChanges();

    expect(component.step()).toBe(1);
    expect(component.step1Error()).toBe('Ce véhicule n\'est pas autorisé pour ce sponsor');
    expect(component.creatingVehicle()).toBe(false);
  });

  // ── Étape 2 : équipement ────────────────────────────────────────────────────

  function goToStep2(): void {
    component.selectVehicle(mockVehicule);
    fixture.detectChanges();
  }

  it('affiche les armes et améliorations disponibles en étape 2', () => {
    goToStep2();
    const el = fixture.nativeElement as HTMLElement;
    const options = el.querySelectorAll('app-equipment-option');

    expect(options).toHaveLength(2); // une arme + une amélioration
    expect(el.textContent).toContain('Mitrailleuse');
    expect(el.textContent).toContain('Blindage');
  });

  it('calcule les emplacements totaux et utilisés du véhicule choisi', () => {
    goToStep2();

    // mockCreatedVehicle est "nu" : 0 utilisé sur 4 disponibles (cf. mockVehicule.emplacements)
    expect(component.emplacementsTotal()).toBe(4);
    expect(component.emplacementsUtilises()).toBe(0);
  });

  it('ajoute une arme, met à jour le véhicule et recharge les équipements disponibles', () => {
    goToStep2();
    vi.clearAllMocks(); // on ne veut compter que les appels déclenchés par addWeapon

    component.addWeapon({ nomInterne: 'mitrailleuse', orientation: 'avant' });
    fixture.detectChanges();

    expect(mockVehicleService.addWeapon).toHaveBeenCalledExactlyOnceWith(100, { nomInterne: 'mitrailleuse', orientation: 'avant' });
    expect(component.createdVehicle()).toEqual(mockVehicleWithWeapon);
    // "Envelopper PUIS valider PUIS persister" (cf. en-tête) : succès ⇒ rechargement
    // des verdicts de disponibilité, les emplacements consommés ayant changé.
    expect(mockVehicleService.getAvailableWeapons).toHaveBeenCalledExactlyOnceWith(100);
    expect(mockVehicleService.getAvailableImprovements).toHaveBeenCalledExactlyOnceWith(100);
    expect(component.emplacementsUtilises()).toBe(1);
  });

  it('affiche la raison du refus si l\'ajout d\'une arme échoue, sans modifier le véhicule', () => {
    goToStep2();
    mockVehicleService.addWeapon.mockReturnValue(
      throwError(() => new HttpErrorResponse({ error: { message: 'Emplacements insuffisants : 5/4 requis avec "Mitrailleuse"' }, status: 400 })),
    );

    component.addWeapon({ nomInterne: 'mitrailleuse', orientation: 'avant' });
    fixture.detectChanges();

    expect(component.step2Error()).toBe('Emplacements insuffisants : 5/4 requis avec "Mitrailleuse"');
    expect(component.createdVehicle()).toEqual(mockCreatedVehicle); // inchangé : rien n'a été persisté
  });

  it('ajoute une amélioration, met à jour le véhicule et recharge les équipements disponibles (mirroir de addWeapon)', () => {
    goToStep2();
    vi.clearAllMocks();

    component.addImprovement({ nomInterne: 'blindage' });
    fixture.detectChanges();

    expect(mockVehicleService.addImprovement).toHaveBeenCalledExactlyOnceWith(100, { nomInterne: 'blindage' });
    expect(component.createdVehicle()).toEqual(mockVehicleWithWeapon);
    expect(mockVehicleService.getAvailableWeapons).toHaveBeenCalledExactlyOnceWith(100);
    expect(mockVehicleService.getAvailableImprovements).toHaveBeenCalledExactlyOnceWith(100);
  });

  // ── Détection "orientation requise" ─────────────────────────────────────────

  it('signale qu\'une orientation est requise pour une arme qui n\'est pas d\'équipage', () => {
    expect(component.weaponNeedsOrientation({ ...mockAvailableWeapon, type: 'base' })).toBe(true);
    expect(component.weaponNeedsOrientation({ ...mockAvailableWeapon, type: 'équipage' })).toBe(false);
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

  // ── Fin du flux ─────────────────────────────────────────────────────────────

  it('émet `finished` au clic sur "Terminer"', () => {
    goToStep2();

    const emitted: void[] = [];
    outputToObservable(component.finished).subscribe((v) => emitted.push(v));

    const btn = fixture.nativeElement.querySelector('.vb-finish') as HTMLButtonElement;
    btn.click();

    expect(emitted).toHaveLength(1);
  });
});
