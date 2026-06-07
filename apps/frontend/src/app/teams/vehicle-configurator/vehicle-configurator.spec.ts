/**
 * Tests unitaires pour VehicleConfigurator — composant "smart" UNIQUE de
 * configuration d'un véhicule (cf. son en-tête : fusion de `VehicleBuilder`/
 * `VehicleEditor`, qui ne se distinguaient que par "comment obtient-on le
 * véhicule de départ ?" et le libellé d'un bouton).
 *
 * Mirroir de `teams.spec.ts` côté approche (composant "smart", on teste
 * l'orchestration — PAS l'affichage interne des sous-composants dumb/partagés
 * `VehicleChoiceCard`/`EquipmentManager`, déjà couverts par leurs propres specs).
 * `EquipmentManager` est rendu RÉELLEMENT (il est `standalone` et importé par
 * `VehicleConfigurator` — on ne peut pas le retirer sans toucher au composant
 * testé) : on complète donc `mockVehicleService` avec les méthodes dont IL a
 * besoin (`getAvailableWeapons`/`getAvailableImprovements`, retournant `of([])`
 * — son affichage n'est pas l'objet de CES tests, cf. `equipment-manager.spec.ts`),
 * et on observe son câblage via `By.directive(EquipmentManager)`.
 *
 * Ne teste QUE ce qui est spécifique à l'obtention du véhicule et à
 * l'orchestration commune :
 *   - mode CRÉATION (`vehicleId` absent/`null`) : chargement du catalogue,
 *     affichage des cartes de choix, création + bascule vers l'équipement,
 *     gestion d'erreur de création
 *   - mode ÉDITION (`vehicleId` fourni) : chargement direct du véhicule visé
 *     parmi ceux de l'équipe, gestion d'incohérence (id introuvable)
 *   - commun : câblage `[vehicle]`/`[sponsorCatalog]`/`[team]`/`(vehicleChanged)`
 *     vers `EquipmentManager`, libellé du bouton ("Terminer"/"Fermer"), `done`
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { VehicleConfigurator } from './vehicle-configurator';
import { EquipmentManager } from './equipment-manager/equipment-manager';
import { CatalogService } from '../../catalog/catalog.service';
import { VehicleService } from './vehicle.service';
import { Sponsor, Vehicule } from '../../catalog/catalog.model';
import { Team } from '../team.model';
import { Vehicle } from './vehicle-builder.model';

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

const mockSponsorCatalog: Sponsor = {
  nom: 'Rutherford',
  description: 'Sponsor militaire.',
  classes_avantage: ['Militaire'],
  avantages_sponsorises: '',
  vehicules: [mockVehicule],
  armes: [],
  ameliorations: [],
};

// Véhicule "nu" retourné par `vehicleService.create` — entité brute, pas encore équipée.
const mockCreatedVehicle: Vehicle = {
  id: 100,
  nomInterne: 'camion',
  teamId: 7,
  improvements: [],
  weapons: [],
  createdAt: '2026-01-01T00:00:00.000Z',
};

// Second véhicule de l'équipe — sert à vérifier l'isolement par `.find()` en mode édition.
const mockOtherVehicle: Vehicle = {
  id: 101,
  nomInterne: 'voiture',
  teamId: 7,
  improvements: [],
  weapons: [],
  createdAt: '2026-01-02T00:00:00.000Z',
};

describe('VehicleConfigurator', () => {
  let fixture: ComponentFixture<VehicleConfigurator>;
  let component: VehicleConfigurator;
  let mockCatalogService: { getSponsorByName: ReturnType<typeof vi.fn> };
  let mockVehicleService: {
    create: ReturnType<typeof vi.fn>;
    getAllForTeam: ReturnType<typeof vi.fn>;
    getAvailableWeapons: ReturnType<typeof vi.fn>;
    getAvailableImprovements: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockCatalogService = {
      getSponsorByName: vi.fn().mockReturnValue(of(mockSponsorCatalog)),
    };
    mockVehicleService = {
      create: vi.fn().mockReturnValue(of(mockCreatedVehicle)),
      getAllForTeam: vi.fn().mockReturnValue(of([mockCreatedVehicle, mockOtherVehicle])),
      // `EquipmentManager` (rendu réellement dès que `vehicle()` est non-nul,
      // cf. en-tête) charge ces deux catalogues dans son `effect()` constructeur
      // — `of([])` suffit : son AFFICHAGE n'est pas l'objet de CES tests.
      getAvailableWeapons: vi.fn().mockReturnValue(of([])),
      getAvailableImprovements: vi.fn().mockReturnValue(of([])),
    };

    await TestBed.configureTestingModule({
      imports: [VehicleConfigurator],
      providers: [
        { provide: CatalogService, useValue: mockCatalogService },
        { provide: VehicleService, useValue: mockVehicleService },
      ],
    }).compileComponents();
  });

  afterEach(() => vi.clearAllMocks());

  function createFixture(vehicleId: number | null): void {
    fixture = TestBed.createComponent(VehicleConfigurator);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('team', mockTeam);
    fixture.componentRef.setInput('vehicleId', vehicleId);
    // detectChanges() déclenche ngOnInit → charge le catalogue (+ le véhicule en mode édition)
    fixture.detectChanges();
  }

  // ── Chargement du catalogue (commun aux deux modes) ─────────────────────────

  it('charge le catalogue du sponsor de l\'équipe au démarrage, quel que soit le mode', () => {
    createFixture(null);

    expect(mockCatalogService.getSponsorByName).toHaveBeenCalledExactlyOnceWith('Rutherford');
    expect(component.sponsorCatalog()).toEqual(mockSponsorCatalog);
    expect(component.loadingCatalog()).toBe(false);
  });

  it('affiche un message d\'erreur si le chargement du catalogue échoue', () => {
    mockCatalogService.getSponsorByName.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

    createFixture(null);

    expect(component.catalogError()).not.toBe('');
    expect(component.loadingCatalog()).toBe(false);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.vc-status--error')?.textContent).toContain('catalogue');
  });

  // ── Mode CRÉATION (vehicleId absent/null) ───────────────────────────────────

  describe('Mode création (vehicleId === null)', () => {
    it('affiche une carte de choix par véhicule autorisé par le sponsor, et aucun véhicule géré', () => {
      createFixture(null);

      const el = fixture.nativeElement as HTMLElement;
      const cards = el.querySelectorAll('app-vehicle-choice-card');

      expect(component.vehicle()).toBeNull();
      expect(cards).toHaveLength(1);
      expect(el.textContent).toContain('Camion');
      expect(el.querySelector('app-equipment-manager')).toBeNull();
    });

    it('crée le véhicule au choix et bascule vers la section équipement', () => {
      createFixture(null);

      component.selectVehicle(mockVehicule);
      fixture.detectChanges();

      expect(mockVehicleService.create).toHaveBeenCalledExactlyOnceWith(7, { nomInterne: 'camion' });
      expect(component.vehicle()).toEqual(mockCreatedVehicle);
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('app-equipment-manager')).toBeTruthy();
      expect(el.querySelector('app-vehicle-choice-card')).toBeNull();
    });

    it('affiche une erreur et reste sur le choix si la création échoue', () => {
      mockVehicleService.create.mockReturnValue(
        throwError(() => new HttpErrorResponse({ error: { message: 'Ce véhicule n\'est pas autorisé pour ce sponsor' }, status: 400 })),
      );
      createFixture(null);

      component.selectVehicle(mockVehicule);
      fixture.detectChanges();

      expect(component.vehicle()).toBeNull();
      expect(component.error()).toBe('Ce véhicule n\'est pas autorisé pour ce sponsor');
      expect(component.creatingVehicle()).toBe(false);
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('app-vehicle-choice-card')).toBeTruthy();
    });

    it('libellé du bouton de fin = "Terminer" en mode création', () => {
      createFixture(null);
      component.selectVehicle(mockVehicule);
      fixture.detectChanges();

      expect(component.doneButtonLabel()).toBe('Terminer');
      const btn = fixture.nativeElement.querySelector('.vc-finish') as HTMLButtonElement;
      expect(btn.textContent?.trim()).toBe('Terminer');
    });
  });

  // ── Mode ÉDITION (vehicleId fourni) ──────────────────────────────────────────

  describe('Mode édition (vehicleId fourni)', () => {
    it('charge directement le véhicule visé parmi ceux de l\'équipe — pas d\'étape de choix', () => {
      createFixture(100);

      expect(mockVehicleService.getAllForTeam).toHaveBeenCalledExactlyOnceWith(7);
      expect(component.vehicle()).toEqual(mockCreatedVehicle);
      expect(component.loadingVehicle()).toBe(false);
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('app-vehicle-choice-card')).toBeNull();
      expect(el.querySelector('app-equipment-manager')).toBeTruthy();
    });

    it('isole le BON véhicule par id (pas le premier de la liste)', () => {
      createFixture(101);

      expect(component.vehicle()).toEqual(mockOtherVehicle);
    });

    it('signale une incohérence si l\'id reçu ne correspond à aucun véhicule de l\'équipe', () => {
      createFixture(999);

      expect(component.vehicle()).toBeNull();
      expect(component.error()).toContain('introuvable');
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('app-equipment-manager')).toBeNull();
    });

    it('affiche une erreur si le chargement du véhicule échoue', () => {
      mockVehicleService.getAllForTeam.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

      createFixture(100);

      expect(component.vehicle()).toBeNull();
      expect(component.error()).toContain('Impossible de charger');
      expect(component.loadingVehicle()).toBe(false);
    });

    it('libellé du bouton de fin = "Fermer" en mode édition', () => {
      createFixture(100);

      expect(component.doneButtonLabel()).toBe('Fermer');
      const btn = fixture.nativeElement.querySelector('.vc-finish') as HTMLButtonElement;
      expect(btn.textContent?.trim()).toBe('Fermer');
    });
  });

  // ── Câblage commun vers EquipmentManager (les deux modes y aboutissent) ─────

  describe('Câblage vers EquipmentManager', () => {
    it('transmet le véhicule, le catalogue et l\'équipe en entrée', () => {
      createFixture(100);

      const manager = fixture.debugElement.query(By.directive(EquipmentManager)).componentInstance as EquipmentManager;

      expect(manager.vehicle()).toEqual(mockCreatedVehicle);
      expect(manager.sponsorCatalog()).toEqual(mockSponsorCatalog);
      expect(manager.team()).toEqual(mockTeam);
    });

    it('met à jour `vehicle` (et le re-fournit en input) quand EquipmentManager émet (vehicleChanged)', () => {
      createFixture(100);

      const updated: Vehicle = {
        ...mockCreatedVehicle,
        weapons: [{ id: 1, nomInterne: 'mitrailleuse', orientation: 'avant', vehicleId: 100, createdAt: '2026-01-01T00:00:01.000Z' }],
      };
      const manager = fixture.debugElement.query(By.directive(EquipmentManager)).componentInstance as EquipmentManager;

      manager.vehicleChanged.emit(updated);
      fixture.detectChanges();

      // Flux unidirectionnel (cf. en-tête d'EquipmentManager, "le parent seul
      // décide") : VehicleConfigurator met à jour SON `vehicle`, qui redescend
      // ensuite en input vers EquipmentManager — pas de mutation directe.
      expect(component.vehicle()).toEqual(updated);
      expect(manager.vehicle()).toEqual(updated);
    });
  });

  // ── Fin du flux ──────────────────────────────────────────────────────────────

  it('émet `done` au clic sur le bouton de fin, quel que soit le mode', () => {
    createFixture(null);
    component.selectVehicle(mockVehicule);
    fixture.detectChanges();

    const emitted: void[] = [];
    outputToObservable(component.done).subscribe((v) => emitted.push(v));

    const btn = fixture.nativeElement.querySelector('.vc-finish') as HTMLButtonElement;
    btn.click();

    expect(emitted).toHaveLength(1);
  });
});
