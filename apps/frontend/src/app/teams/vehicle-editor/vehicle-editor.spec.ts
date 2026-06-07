/**
 * Tests unitaires pour VehicleEditor.
 *
 * Mirroir de `vehicle-builder.spec.ts` (cf. son en-tête — composant "smart",
 * on teste son rôle d'orchestration, pas l'affichage interne des sous-composants
 * dumb déjà couverts ailleurs). `CatalogService`/`VehicleService` mockés, mêmes
 * conventions (`of`/`throwError`, `outputToObservable`, `vi.stubGlobal('confirm', …)`
 * — ce dernier mirroir de `teams.spec.ts`, "suppression d'équipe").
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { VehicleEditor } from './vehicle-editor';
import { CatalogService } from '../../catalog/catalog.service';
import { VehicleService } from '../vehicle-builder/vehicle.service';
import { Sponsor, Vehicule } from '../../catalog/catalog.model';
import { Team } from '../team.model';
import { AvailableImprovementDto, AvailableWeaponDto, Vehicle, VehicleImprovement } from '../vehicle-builder/vehicle-builder.model';

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

// Catalogue complet du sponsor — alimente résolution d'affichage ET équipement disponible
// (cf. `mockSponsorCatalog` de vehicle-builder.spec.ts, même rôle double).
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

// Le véhicule visé par l'éditeur — déjà équipé d'une arme (cf. en-tête : c'est
// précisément ce qui distingue l'éditeur du builder, qui démarre "nu").
const mockVehicle: Vehicle = {
  id: 100,
  nomInterne: 'camion',
  teamId: 7,
  improvements: [],
  weapons: [{ id: 200, nomInterne: 'mitrailleuse', orientation: 'avant', vehicleId: 100, createdAt: '2026-01-01T00:00:00.000Z' }],
  createdAt: '2026-01-01T00:00:00.000Z',
};

// Un autre véhicule de l'équipe — présent dans `getAllForTeam` pour vérifier
// que l'éditeur isole bien CELUI visé par `vehicleId` (et pas le premier venu).
const mockOtherVehicle: Vehicle = {
  id: 101,
  nomInterne: 'voiture',
  teamId: 7,
  improvements: [],
  weapons: [],
  createdAt: '2026-01-01T00:00:00.000Z',
};

// Véhicule rechargé après un ajout/retrait — utilisé pour vérifier le recalcul
// des emplacements (mirroir de `mockVehicleWithWeapon` du builder).
const mockVehicleWithImprovement: Vehicle = {
  ...mockVehicle,
  improvements: [{ id: 300, nomInterne: 'blindage', orientation: null, vehicleId: 100, createdAt: '2026-01-01T00:00:01.000Z' }],
};

const mockVehicleStripped: Vehicle = {
  ...mockVehicle,
  weapons: [],
};

const mockAvailableWeapon: AvailableWeaponDto = {
  nom: 'Mitrailleuse',
  nomInterne: 'mitrailleuse',
  prix: 4,
  emplacement: 1,
  type: 'base',
  disponible: false,
  raison: 'Une orientation est requise pour monter "Mitrailleuse" sur un arc de tir',
};

const mockAvailableImprovement: AvailableImprovementDto = {
  nom: 'Blindage',
  nomInterne: 'blindage',
  prix: 4,
  emplacement: 1,
  disponible: true,
};

describe('VehicleEditor', () => {
  let component: VehicleEditor;
  let fixture: ComponentFixture<VehicleEditor>;
  let mockCatalogService: { getSponsorByName: ReturnType<typeof vi.fn> };
  let mockVehicleService: {
    getAllForTeam: ReturnType<typeof vi.fn>;
    getAvailableWeapons: ReturnType<typeof vi.fn>;
    getAvailableImprovements: ReturnType<typeof vi.fn>;
    addWeapon: ReturnType<typeof vi.fn>;
    addImprovement: ReturnType<typeof vi.fn>;
    removeWeapon: ReturnType<typeof vi.fn>;
    removeImprovement: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockCatalogService = {
      getSponsorByName: vi.fn().mockReturnValue(of(mockSponsorCatalog)),
    };
    mockVehicleService = {
      getAllForTeam: vi.fn().mockReturnValue(of([mockVehicle, mockOtherVehicle])),
      getAvailableWeapons: vi.fn().mockReturnValue(of([mockAvailableWeapon])),
      getAvailableImprovements: vi.fn().mockReturnValue(of([mockAvailableImprovement])),
      addWeapon: vi.fn().mockReturnValue(of(mockVehicleWithImprovement)),
      addImprovement: vi.fn().mockReturnValue(of(mockVehicleWithImprovement)),
      removeWeapon: vi.fn().mockReturnValue(of(undefined)),
      removeImprovement: vi.fn().mockReturnValue(of(undefined)),
    };

    await TestBed.configureTestingModule({
      imports: [VehicleEditor],
      providers: [
        { provide: CatalogService, useValue: mockCatalogService },
        { provide: VehicleService, useValue: mockVehicleService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VehicleEditor);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('team', mockTeam);
    fixture.componentRef.setInput('vehicleId', 100);
    // detectChanges() déclenche ngOnInit → charge véhicule + catalogue + équipements
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  // ── Chargement initial ──────────────────────────────────────────────────────

  it('charge le véhicule visé (parmi ceux de l\'équipe) et le catalogue du sponsor au démarrage', () => {
    expect(mockVehicleService.getAllForTeam).toHaveBeenCalledExactlyOnceWith(7);
    expect(mockCatalogService.getSponsorByName).toHaveBeenCalledExactlyOnceWith('Rutherford');
    // Isole bien le véhicule #100 — pas le #101, présent dans la même réponse.
    expect(component.vehicle()).toEqual(mockVehicle);
    expect(component.sponsorCatalog()).toEqual(mockSponsorCatalog);
    expect(component.loading()).toBe(false);
  });

  it('charge ensuite les équipements disponibles pour le véhicule isolé', () => {
    expect(mockVehicleService.getAvailableWeapons).toHaveBeenCalledExactlyOnceWith(100);
    expect(mockVehicleService.getAvailableImprovements).toHaveBeenCalledExactlyOnceWith(100);
    expect(component.availableWeapons()).toEqual([mockAvailableWeapon]);
    expect(component.availableImprovements()).toEqual([mockAvailableImprovement]);
  });

  it('affiche une erreur si le chargement du véhicule/catalogue échoue', () => {
    mockVehicleService.getAllForTeam.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

    fixture = TestBed.createComponent(VehicleEditor);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('team', mockTeam);
    fixture.componentRef.setInput('vehicleId', 100);
    fixture.detectChanges();

    expect(component.error()).not.toBe('');
    expect(component.loading()).toBe(false);
  });

  it('signale une incohérence si l\'id reçu ne correspond à aucun véhicule de l\'équipe', () => {
    mockVehicleService.getAllForTeam.mockReturnValue(of([mockOtherVehicle])); // pas de #100

    fixture = TestBed.createComponent(VehicleEditor);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('team', mockTeam);
    fixture.componentRef.setInput('vehicleId', 100);
    fixture.detectChanges();

    expect(component.vehicle()).toBeNull();
    expect(component.error()).toContain('introuvable');
  });

  // ── Emplacements (computed) ─────────────────────────────────────────────────

  it('calcule les emplacements totaux et utilisés du véhicule édité', () => {
    // mockVehicle porte une arme à 1 emplacement (mitrailleuse) : 1 utilisé sur 4
    expect(component.emplacementsTotal()).toBe(4);
    expect(component.emplacementsUtilises()).toBe(1);
  });

  // ── Équipement actuel — affichage ───────────────────────────────────────────

  it('affiche l\'équipement actuellement monté avec son nom résolu depuis le catalogue', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Mitrailleuse');
    expect(el.querySelectorAll('.ve-current__remove')).toHaveLength(1);
  });

  // ── Ajout d'équipement (mirroir du builder) ─────────────────────────────────

  it('ajoute une arme, met à jour le véhicule et recharge les équipements disponibles', () => {
    vi.clearAllMocks();

    component.addWeapon({ nomInterne: 'mitrailleuse', orientation: 'avant' });
    fixture.detectChanges();

    expect(mockVehicleService.addWeapon).toHaveBeenCalledExactlyOnceWith(100, { nomInterne: 'mitrailleuse', orientation: 'avant' });
    expect(component.vehicle()).toEqual(mockVehicleWithImprovement);
    expect(mockVehicleService.getAvailableWeapons).toHaveBeenCalledExactlyOnceWith(100);
    expect(mockVehicleService.getAvailableImprovements).toHaveBeenCalledExactlyOnceWith(100);
  });

  it('affiche la raison du refus si l\'ajout d\'une amélioration échoue, sans modifier le véhicule', () => {
    mockVehicleService.addImprovement.mockReturnValue(
      throwError(() => new HttpErrorResponse({ error: { message: 'Emplacements insuffisants : 5/4 requis avec "Blindage"' }, status: 400 })),
    );

    component.addImprovement({ nomInterne: 'blindage' });
    fixture.detectChanges();

    expect(component.equipmentError()).toBe('Emplacements insuffisants : 5/4 requis avec "Blindage"');
    expect(component.vehicle()).toEqual(mockVehicle); // inchangé : rien n'a été persisté
  });

  // ── Retrait d'équipement (NOUVEAU — symétrique de l'ajout) ──────────────────

  describe('removeWeapon()', () => {
    it('demande confirmation puis retire l\'arme et recharge le véhicule', () => {
      vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
      mockVehicleService.getAllForTeam.mockReturnValue(of([mockVehicleStripped, mockOtherVehicle]));

      component.removeWeapon(mockVehicle.weapons[0]);
      fixture.detectChanges();

      expect(window.confirm).toHaveBeenCalledExactlyOnceWith('Retirer "Mitrailleuse" de ce véhicule ?');
      expect(mockVehicleService.removeWeapon).toHaveBeenCalledExactlyOnceWith(200);
      // 204 No Content : pas d'entité exploitable ⇒ rechargement via getAllForTeam
      expect(component.vehicle()).toEqual(mockVehicleStripped);
    });

    it('n\'appelle pas le service si l\'utilisateur annule la confirmation', () => {
      vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));

      component.removeWeapon(mockVehicle.weapons[0]);

      expect(mockVehicleService.removeWeapon).not.toHaveBeenCalled();
    });
  });

  describe('removeImprovement()', () => {
    it('demande confirmation puis retire l\'amélioration et recharge le véhicule (mirroir de removeWeapon)', () => {
      vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
      const installedBlindage: VehicleImprovement = { id: 300, nomInterne: 'blindage', orientation: null, vehicleId: 100, createdAt: '2026-01-01T00:00:01.000Z' };

      component.removeImprovement(installedBlindage);
      fixture.detectChanges();

      expect(window.confirm).toHaveBeenCalledExactlyOnceWith('Retirer "Blindage" de ce véhicule ?');
      expect(mockVehicleService.removeImprovement).toHaveBeenCalledExactlyOnceWith(100, 300);
    });

    it('n\'appelle pas le service si l\'utilisateur annule la confirmation', () => {
      vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
      const installedBlindage: VehicleImprovement = { id: 300, nomInterne: 'blindage', orientation: null, vehicleId: 100, createdAt: '2026-01-01T00:00:01.000Z' };

      component.removeImprovement(installedBlindage);

      expect(mockVehicleService.removeImprovement).not.toHaveBeenCalled();
    });
  });

  // ── Détection "orientation requise" (mirroir exact du builder) ──────────────

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
    expect(component.improvementNeedsOrientation(mockAvailableImprovement)).toBe(false);
  });

  // ── Résolution d'affichage ──────────────────────────────────────────────────

  it('résout les noms affichables depuis le catalogue, avec repli sur `nomInterne`', () => {
    expect(component.resolveWeaponName('mitrailleuse')).toBe('Mitrailleuse');
    expect(component.resolveWeaponName('inconnu')).toBe('inconnu');
    expect(component.resolveImprovementName('blindage')).toBe('Blindage');
    expect(component.resolveImprovementName('inconnu')).toBe('inconnu');
  });

  // ── Fermeture ───────────────────────────────────────────────────────────────

  it('émet `closed` au clic sur "Fermer"', () => {
    const emitted: void[] = [];
    outputToObservable(component.closed).subscribe((v) => emitted.push(v));

    const btn = fixture.nativeElement.querySelector('.ve-close') as HTMLButtonElement;
    btn.click();

    expect(emitted).toHaveLength(1);
  });
});
