/**
 * Tests unitaires pour `buildVehicleSummary` (fonction pure).
 *
 * Pas de TestBed, pas d'injection : on appelle directement la fonction avec des
 * fixtures `Vehicle`/`Sponsor` construites à la main — exactement la promesse
 * d'une fonction pure (cf. son en-tête, "trivialement testable en isolation").
 */
import { buildVehicleSummary, VehicleSummary } from './vehicle-summary';
import { Vehicle, Weapon, VehicleImprovement } from './vehicle-configurator/vehicle-builder.model';
import { Sponsor, Vehicule, Arme, Amelioration } from '../catalog/catalog.model';

// ── Fixtures catalogue ───────────────────────────────────────────────────────
// Un sous-ensemble minimal mais réaliste : un véhicule, deux armes (prix nombre),
// une amélioration "normale" (prix nombre) et la Tourelle (prix "x3" — le cas
// particulier que `coutApproximatif` doit signaler).

const mockVehiculeCatalogue: Vehicule = {
  nom: 'Camion',
  nom_interne: 'camion',
  poids: 'Moyen',
  carrosserie: 0,
  manoeuvrabilite: 0,
  vitesse_max: 0,
  equipage: 0,
  emplacements: 3,
  prix: 15,
  description: '',
  regles: '',
  sponsors_autorises: [],
};

const mockMitrailleuse: Arme = {
  nom: 'Mitrailleuse',
  nom_interne: 'mitrailleuse',
  type: 'base',
  prix: 2,
  emplacement: 1,
  description: '',
  regles: '',
  sponsors_autorises: [],
};

const mockMinigun: Arme = {
  nom: 'Minigun',
  nom_interne: 'minigun',
  type: 'base',
  prix: 5,
  emplacement: 1,
  description: '',
  regles: '',
  sponsors_autorises: [],
};

const mockBlindage: Amelioration = {
  nom: 'Blindage',
  nom_interne: 'blindage',
  prix: 4,
  emplacement: 1,
  description: '',
  regles: '',
  sponsors_autorises: [],
};

const mockTourelle: Amelioration = {
  nom: 'Tourelle',
  nom_interne: 'tourelle',
  prix: 'x3',
  emplacement: 0,
  description: '',
  regles: '',
  sponsors_autorises: [],
};

const mockCatalog: Sponsor = {
  nom: 'Rutherford',
  description: '',
  classes_avantage: [],
  avantages_sponsorises: '',
  vehicules: [mockVehiculeCatalogue],
  armes: [mockMitrailleuse, mockMinigun],
  ameliorations: [mockBlindage, mockTourelle],
};

// ── Fixtures véhicules d'équipe ──────────────────────────────────────────────
// Constructeurs locaux : on ne fait varier que les champs qui comptent pour le
// test (improvements/weapons), le reste est un squelette `Vehicle` minimal.

function buildWeapon(nomInterne: string): Weapon {
  return { id: 1, nomInterne, orientation: 'avant', vehicleId: 1, createdAt: '2025-01-01T00:00:00.000Z' };
}

function buildImprovement(nomInterne: string): VehicleImprovement {
  return { id: 1, nomInterne, orientation: null, vehicleId: 1, createdAt: '2025-01-01T00:00:00.000Z' };
}

function buildVehicle(weapons: Weapon[], improvements: VehicleImprovement[]): Vehicle {
  return {
    id: 1,
    nomInterne: 'camion',
    teamId: 4,
    improvements,
    weapons,
    createdAt: '2025-01-01T00:00:00.000Z',
  };
}

describe('buildVehicleSummary', () => {
  // ── Cas de base ────────────────────────────────────────────────────────────

  it('résout le nom depuis le catalogue (PAS nomInterne)', () => {
    const summary: VehicleSummary = buildVehicleSummary(buildVehicle([], []), mockCatalog);

    expect(summary.nom).toBe('Camion');
  });

  it('un véhicule "nu" (sans équipement) coûte uniquement son prix de base', () => {
    const summary: VehicleSummary = buildVehicleSummary(buildVehicle([], []), mockCatalog);

    expect(summary.cout).toBe(15);
    expect(summary.coutApproximatif).toBe(false);
  });

  // ── Armes ──────────────────────────────────────────────────────────────────

  it('additionne le prix de chaque arme montée au prix de base', () => {
    const vehicle = buildVehicle([buildWeapon('mitrailleuse'), buildWeapon('minigun')], []);
    const summary: VehicleSummary = buildVehicleSummary(vehicle, mockCatalog);

    // 15 (camion) + 2 (mitrailleuse) + 5 (minigun)
    expect(summary.cout).toBe(22);
    expect(summary.coutApproximatif).toBe(false);
  });

  // ── Améliorations "normales" (prix nombre) ────────────────────────────────

  it('additionne le prix d\'une amélioration au prix nombre', () => {
    const vehicle = buildVehicle([], [buildImprovement('blindage')]);
    const summary: VehicleSummary = buildVehicleSummary(vehicle, mockCatalog);

    // 15 (camion) + 4 (blindage)
    expect(summary.cout).toBe(19);
    expect(summary.coutApproximatif).toBe(false);
  });

  // ── Cas Tourelle (prix "x3") — le cœur de la décision actée ────────────────

  it('exclut la Tourelle de la somme ET signale coutApproximatif (décision actée : ignorer plutôt que deviner)', () => {
    const vehicle = buildVehicle([], [buildImprovement('tourelle')]);
    const summary: VehicleSummary = buildVehicleSummary(vehicle, mockCatalog);

    // 15 (camion) — la Tourelle ("x3") ne contribue PAS au total
    expect(summary.cout).toBe(15);
    expect(summary.coutApproximatif).toBe(true);
  });

  it('combine Tourelle ET amélioration normale : seule la seconde contribue au total, le drapeau reste levé', () => {
    const vehicle = buildVehicle([], [buildImprovement('blindage'), buildImprovement('tourelle')]);
    const summary: VehicleSummary = buildVehicleSummary(vehicle, mockCatalog);

    // 15 (camion) + 4 (blindage) — Tourelle exclue
    expect(summary.cout).toBe(19);
    expect(summary.coutApproximatif).toBe(true);
  });

  // ── Cas combiné réaliste ───────────────────────────────────────────────────

  it('combine véhicule de base + armes + améliorations dans un seul total', () => {
    const vehicle = buildVehicle(
      [buildWeapon('mitrailleuse')],
      [buildImprovement('blindage')],
    );
    const summary: VehicleSummary = buildVehicleSummary(vehicle, mockCatalog);

    // 15 (camion) + 2 (mitrailleuse) + 4 (blindage)
    expect(summary.cout).toBe(21);
    expect(summary.coutApproximatif).toBe(false);
  });

  // ── Robustesse — incohérence de données (ne devrait jamais arriver, cf. doc) ─

  it('se rabat sur nomInterne si le véhicule est introuvable dans le catalogue', () => {
    const vehicle: Vehicle = { ...buildVehicle([], []), nomInterne: 'inconnu_du_catalogue' };
    const summary: VehicleSummary = buildVehicleSummary(vehicle, mockCatalog);

    expect(summary.nom).toBe('inconnu_du_catalogue');
    expect(summary.cout).toBe(0); // pas de prix de base résolu
  });

  it('ignore silencieusement une arme/amélioration introuvable dans le catalogue (contribution nulle)', () => {
    const vehicle = buildVehicle([buildWeapon('arme_fantome')], [buildImprovement('amelioration_fantome')]);
    const summary: VehicleSummary = buildVehicleSummary(vehicle, mockCatalog);

    // Seul le prix de base du véhicule compte — les items fantômes ne contribuent pas
    expect(summary.cout).toBe(15);
    expect(summary.coutApproximatif).toBe(false);
  });

  // ── Identité ───────────────────────────────────────────────────────────────

  it('reporte l\'id du véhicule (utilisé par @for/track côté TeamCard)', () => {
    const vehicle = { ...buildVehicle([], []), id: 42 };
    const summary: VehicleSummary = buildVehicleSummary(vehicle, mockCatalog);

    expect(summary.id).toBe(42);
  });
});
