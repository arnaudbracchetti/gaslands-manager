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
  prix: 3,
  emplacement: 1,
  description: '',
  regles: '',
  sponsors_autorises: [],
};

const mockMinigun: Arme = {
  nom: 'Minigun',
  nom_interne: 'minigun',
  type: 'base',
  prix: 6,
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
// Les prix des armes et améliorations sont résolus côté BACKEND et fournis dans
// le DTO (`weapon.prix`, `improvement.prix`). `buildVehicleSummary` les consomme
// directement — les fixtures doivent donc inclure les champs du DTO complet.

function buildWeapon(nomInterne: string, prix: number): Weapon {
  return { id: 1, nomInterne, orientation: 'avant', vehicleId: 1, createdAt: '2025-01-01T00:00:00.000Z', prix };
}

function buildImprovement(
  nomInterne: string,
  prix: number,
  estDefaut = false,
  weaponNomInterne: string | null = null,
  emplacement = 0,
): VehicleImprovement {
  return { id: 1, nomInterne, orientation: null, vehicleId: 1, createdAt: '2025-01-01T00:00:00.000Z', estDefaut, prix, emplacement, weaponNomInterne };
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
  });

  // ── Armes ──────────────────────────────────────────────────────────────────

  it('additionne le prix de chaque arme montée au prix de base', () => {
    const vehicle = buildVehicle([buildWeapon('mitrailleuse', 3), buildWeapon('minigun', 6)], []);
    const summary: VehicleSummary = buildVehicleSummary(vehicle, mockCatalog);

    // 15 (camion) + 3 (mitrailleuse) + 6 (minigun)
    expect(summary.cout).toBe(24);
  });

  // ── Améliorations "normales" ───────────────────────────────────────────────

  it('additionne le prix d\'une amélioration normale', () => {
    const vehicle = buildVehicle([], [buildImprovement('blindage', 4)]);
    const summary: VehicleSummary = buildVehicleSummary(vehicle, mockCatalog);

    // 15 (camion) + 4 (blindage)
    expect(summary.cout).toBe(19);
  });

  // ── Cas Tourelle — prix désormais EXACT ────────────────────────────────────

  it('Tourelle ASSIGNÉE : ajoute 3× le prix de l\'arme (prix résolu côté backend)', () => {
    // Le backend stocke `improvement.prix = 9` (3 × 3j de la Mitrailleuse).
    // `buildVehicleSummary` additionne simplement ce prix, comme toute amélioration.
    const vehicle = buildVehicle(
      [],
      [buildImprovement('tourelle', 9, false, 'mitrailleuse')],
    );
    const summary: VehicleSummary = buildVehicleSummary(vehicle, mockCatalog);

    // 15 (camion) + 9 (Tourelle + Mitrailleuse, coût total résolu)
    expect(summary.cout).toBe(24);
  });

  it('Tourelle ORPHELINE (aucune arme assignée) : prix = 0 en attendant l\'assignation', () => {
    // La Tourelle orpheline a prix = 0 dans le DTO (backend : weaponNomInterne null → 0).
    const vehicle = buildVehicle([], [buildImprovement('tourelle', 0)]);
    const summary: VehicleSummary = buildVehicleSummary(vehicle, mockCatalog);

    // 15 (camion) — Tourelle orpheline contribue 0
    expect(summary.cout).toBe(15);
  });

  it('Tourelle INTÉGRÉE au profil de base (estDefaut: true) : prix = 0', () => {
    // Char d'assaut : Tourelle intégrée — coût zéro par définition (estDefaut).
    // Le backend retourne prix = 0 même si une arme est assignée dessus.
    const vehicle = buildVehicle([], [buildImprovement('tourelle', 0, /* estDefaut */ true, 'canon_125mm')]);
    const summary: VehicleSummary = buildVehicleSummary(vehicle, mockCatalog);

    expect(summary.cout).toBe(15); // prix de base seulement — Tourelle intégrée coûte 0
  });

  it('combine Tourelle assignée ET amélioration normale dans un total exact', () => {
    const vehicle = buildVehicle(
      [],
      [buildImprovement('blindage', 4), buildImprovement('tourelle', 18, false, 'minigun')],
    );
    const summary: VehicleSummary = buildVehicleSummary(vehicle, mockCatalog);

    // 15 (camion) + 4 (blindage) + 18 (Tourelle + Minigun = 3 × 6j)
    expect(summary.cout).toBe(37);
  });

  // ── Cas combiné réaliste ───────────────────────────────────────────────────

  it('combine véhicule de base + armes + améliorations dans un seul total', () => {
    const vehicle = buildVehicle(
      [buildWeapon('mitrailleuse', 3)],
      [buildImprovement('blindage', 4)],
    );
    const summary: VehicleSummary = buildVehicleSummary(vehicle, mockCatalog);

    // 15 (camion) + 3 (mitrailleuse) + 4 (blindage)
    expect(summary.cout).toBe(22);
  });

  // ── Robustesse ─────────────────────────────────────────────────────────────

  it('se rabat sur nomInterne si le véhicule est introuvable dans le catalogue', () => {
    const vehicle: Vehicle = { ...buildVehicle([], []), nomInterne: 'inconnu_du_catalogue' };
    const summary: VehicleSummary = buildVehicleSummary(vehicle, mockCatalog);

    expect(summary.nom).toBe('inconnu_du_catalogue');
    expect(summary.cout).toBe(0); // pas de prix de base résolu
  });

  it('ignore silencieusement les items avec prix = 0 (défauts, orphelins, inconnus)', () => {
    const vehicle = buildVehicle([buildWeapon('arme_fantome', 0)], [buildImprovement('amelioration_fantome', 0)]);
    const summary: VehicleSummary = buildVehicleSummary(vehicle, mockCatalog);

    expect(summary.cout).toBe(15); // seul le prix de base compte
  });

  // ── Identité ───────────────────────────────────────────────────────────────

  it('reporte l\'id du véhicule (utilisé par @for/track côté TeamCard)', () => {
    const vehicle = { ...buildVehicle([], []), id: 42 };
    const summary: VehicleSummary = buildVehicleSummary(vehicle, mockCatalog);

    expect(summary.id).toBe(42);
  });
});
