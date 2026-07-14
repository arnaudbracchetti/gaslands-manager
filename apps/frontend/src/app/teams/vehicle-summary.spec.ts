/**
 * Tests unitaires pour `buildVehicleSummary` (fonction pure).
 *
 * Pas de TestBed, pas d'injection : on appelle directement la fonction avec des
 * fixtures `Vehicle`/`Sponsor` construites à la main — exactement la promesse
 * d'une fonction pure (cf. son en-tête, "trivialement testable en isolation").
 */
import { buildVehicleSummary, VehicleSummary } from './vehicle-summary';
import { Vehicle, Weapon, VehicleImprovement, VehicleAdvantage } from './vehicle-configurator/vehicle-builder.model';
import { Sponsor, Vehicule, Arme, Amelioration, Avantage } from '../catalog/catalog.model';

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
  necessite_orientation: true,
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
  montable_tourelle: true,
  necessite_orientation: true,
};

const mockBlindage: Amelioration = {
  nom: 'Blindage',
  nom_interne: 'blindage',
  prix: 4,
  emplacement: 1,
  description: '',
  regles: '',
  sponsors_autorises: [],
  necessite_orientation: false,
};

const mockExpertise: Avantage = {
  nom: 'Expertise',
  nom_interne: 'expertise',
  categorie: 'Précision',
  prix: 3,
  description: '',
  regles: '',
};

const mockCatalog: Sponsor = {
  nom: 'Rutherford',
  description: '',
  classes_avantage: [],
  avantages_sponsorises: '',
  vehicules: [mockVehiculeCatalogue],
  armes: [mockMitrailleuse, mockMinigun],
  ameliorations: [mockBlindage],
  avantages: [mockExpertise],
};

// ── Fixtures véhicules d'équipe ──────────────────────────────────────────────
// Les prix des armes et améliorations sont résolus côté BACKEND et fournis dans
// le DTO (`weapon.prix`, `improvement.prix`). `buildVehicleSummary` les consomme
// directement — les fixtures doivent donc inclure les champs du DTO complet.

function buildWeapon(
  nomInterne: string,
  prix: number,
  sold?: boolean,
  lost?: boolean,
  montageTourelle = false,
  estDefaut = false,
): Weapon {
  return {
    id: 1, nomInterne, orientation: montageTourelle ? 'tourelle' : 'avant', vehicleId: 1,
    createdAt: '2025-01-01T00:00:00.000Z', prix, estDefaut, sold, lost,
  };
}

function buildImprovement(
  nomInterne: string,
  prix: number,
  estDefaut = false,
  emplacement = 0,
): VehicleImprovement {
  return { id: 1, nomInterne, orientation: null, vehicleId: 1, createdAt: '2025-01-01T00:00:00.000Z', estDefaut, prix, emplacement };
}

function buildAdvantage(nomInterne: string, prix: number, sold?: boolean): VehicleAdvantage {
  return { id: 1, nomInterne, vehicleId: 1, createdAt: '2025-01-01T00:00:00.000Z', prix, sold };
}

function buildVehicle(
  weapons: Weapon[],
  improvements: VehicleImprovement[],
  advantages: VehicleAdvantage[] = [],
  // Résolu côté backend (`Vehicle.effectiveStats.emplacements`) — égal à
  // `mockVehiculeCatalogue.emplacements` (3) par défaut, en l'absence de toute
  // amélioration de capacité (Remorque Moyenne/Lourde) montée.
  emplacementsTotal = 3,
): Vehicle {
  return {
    id: 1,
    nomInterne: 'camion',
    teamId: 4,
    improvements,
    weapons,
    advantages,
    createdAt: '2025-01-01T00:00:00.000Z',
    emplacementsTotal,
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

  // ── Cas Tourelle — attribut de l'arme, prix EXACT résolu côté backend ───────

  it('arme montée sur Tourelle : ajoute son prix ×3 (résolu côté backend)', () => {
    // Le backend stocke `weapon.prix = 9` (3 × 3j de la Mitrailleuse).
    // `buildVehicleSummary` additionne simplement ce prix, comme toute arme.
    const vehicle = buildVehicle(
      [buildWeapon('mitrailleuse', 9, false, false, /* montageTourelle */ true)],
      [],
    );
    const summary: VehicleSummary = buildVehicleSummary(vehicle, mockCatalog);

    // 15 (camion) + 9 (Mitrailleuse montée sur Tourelle, coût total résolu)
    expect(summary.cout).toBe(24);
  });

  it('arme intégrée montée sur Tourelle (Canon de 125mm du Char d\'assaut, estDefaut) : prix = 0', () => {
    // Le backend retourne prix = 0 pour une arme estDefaut, même montée sur Tourelle.
    const vehicle = buildVehicle(
      [buildWeapon('canon_125mm', 0, false, false, /* montageTourelle */ true, /* estDefaut */ true)],
      [],
    );
    const summary: VehicleSummary = buildVehicleSummary(vehicle, mockCatalog);

    expect(summary.cout).toBe(15); // prix de base seulement — arme intégrée coûte 0
  });

  it('combine une arme montée sur Tourelle ET une amélioration normale dans un total exact', () => {
    const vehicle = buildVehicle(
      [buildWeapon('minigun', 18, false, false, /* montageTourelle */ true)],
      [buildImprovement('blindage', 4)],
    );
    const summary: VehicleSummary = buildVehicleSummary(vehicle, mockCatalog);

    // 15 (camion) + 18 (Minigun montée sur Tourelle = 3 × 6j) + 4 (blindage)
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

  // ── Emplacements ──────────────────────────────────────────────────────────

  it('expose emplacementsTotal fourni par le véhicule (backend), pas la fiche catalogue', () => {
    const summary: VehicleSummary = buildVehicleSummary(buildVehicle([], []), mockCatalog);

    expect(summary.emplacementsTotal).toBe(3); // valeur par défaut de buildVehicle()
  });

  /**
   * Régression IHM : `emplacementsTotal` doit toujours refléter `vehicle.emplacementsTotal`
   * (résolu côté backend, bonus Remorque Moyenne/Lourde inclus), JAMAIS être recalculé
   * depuis `Vehicule.emplacements` (fiche catalogue statique, ici figée à 3). Bug corrigé :
   * la jauge d'emplacements de `TeamCard`/`VehicleSummaryCard` restait bloquée sur la
   * capacité de base et ne bougeait jamais quand une remorque augmentant la capacité
   * était montée.
   */
  it('reflète emplacementsTotal du véhicule même quand il diffère de la fiche catalogue (bonus Remorque)', () => {
    const vehicle = buildVehicle([], [], [], /* emplacementsTotal */ 4);
    const summary: VehicleSummary = buildVehicleSummary(vehicle, mockCatalog);

    expect(summary.emplacementsTotal).toBe(4);
  });

  it('emplacementsUtilises = 0 pour un véhicule "nu"', () => {
    const summary: VehicleSummary = buildVehicleSummary(buildVehicle([], []), mockCatalog);

    expect(summary.emplacementsUtilises).toBe(0);
  });

  it('compte les emplacements des armes montées (via catalogue)', () => {
    // Mitrailleuse : 1 emplacement, Minigun : 1 emplacement
    const vehicle = buildVehicle([buildWeapon('mitrailleuse', 3), buildWeapon('minigun', 6)], []);
    const summary: VehicleSummary = buildVehicleSummary(vehicle, mockCatalog);

    expect(summary.emplacementsUtilises).toBe(2);
  });

  it('compte les emplacements des améliorations achetées (via improvement.emplacement)', () => {
    // Blindage : emplacement = 1 (valeur dans le DTO)
    const vehicle = buildVehicle([], [buildImprovement('blindage', 4, false, 1)]);
    const summary: VehicleSummary = buildVehicleSummary(vehicle, mockCatalog);

    expect(summary.emplacementsUtilises).toBe(1);
  });

  it('ignore les emplacements des améliorations estDefaut', () => {
    // Amélioration intégrée — ne consomme pas d'emplacement achetable
    const vehicle = buildVehicle([], [buildImprovement('blindage', 0, /* estDefaut */ true, 0)]);
    const summary: VehicleSummary = buildVehicleSummary(vehicle, mockCatalog);

    expect(summary.emplacementsUtilises).toBe(0);
  });

  it('ignore les emplacements des armes estDefaut (même montées sur Tourelle)', () => {
    const vehicle = buildVehicle(
      [buildWeapon('minigun', 0, false, false, /* montageTourelle */ true, /* estDefaut */ true)],
      [],
    );
    const summary: VehicleSummary = buildVehicleSummary(vehicle, mockCatalog);

    expect(summary.emplacementsUtilises).toBe(0);
  });

  it('combine emplacements armes + améliorations', () => {
    const vehicle = buildVehicle(
      [buildWeapon('mitrailleuse', 3)],
      [buildImprovement('blindage', 4, false, 1)],
    );
    const summary: VehicleSummary = buildVehicleSummary(vehicle, mockCatalog);

    expect(summary.emplacementsUtilises).toBe(2); // 1 (arme) + 1 (blindage)
  });

  // ── Arme vendue/perdue (atelier, annulation vs revente, Table des Épaves) ────
  // `weapon.sold`/`weapon.lost` n'existent qu'en atelier (jamais posés côté
  // construction d'équipe, toujours undefined dans ce contexte) — le filtre ne
  // change donc jamais rien pour Teams/TeamEditPage.

  it('une arme vendue libère son emplacement, reste incluse dans le coût, mais disparaît des tags', () => {
    const vehicle = buildVehicle([buildWeapon('mitrailleuse', 3, true)], []);
    const summary: VehicleSummary = buildVehicleSummary(vehicle, mockCatalog);

    expect(summary.cout).toBe(18); // 15 (camion) + 3 (arme vendue, prix résiduel déjà appliqué côté backend)
    expect(summary.emplacementsUtilises).toBe(0); // emplacement libéré
    expect(summary.equipements).not.toContain('Mitrailleuse'); // n'est plus une arme active
  });

  it('une arme perdue (Table des Épaves) libère son emplacement et disparaît des tags', () => {
    const vehicle = buildVehicle([buildWeapon('mitrailleuse', 3, false, true)], []);
    const summary: VehicleSummary = buildVehicleSummary(vehicle, mockCatalog);

    expect(summary.emplacementsUtilises).toBe(0);
    expect(summary.equipements).not.toContain('Mitrailleuse');
  });

  it('combine une arme active et une arme vendue : seule l\'active compte pour les emplacements et les tags', () => {
    const vehicle = buildVehicle(
      [buildWeapon('mitrailleuse', 3), buildWeapon('minigun', 6, true)],
      [],
    );
    const summary: VehicleSummary = buildVehicleSummary(vehicle, mockCatalog);

    expect(summary.emplacementsUtilises).toBe(1); // mitrailleuse seule (minigun vendue exclue)
    expect(summary.cout).toBe(24); // 15 + 3 + 6 — le coût inclut toujours les deux
    expect(summary.equipements).toEqual(['Mitrailleuse']); // minigun vendue exclue des tags
  });

  // ── Avantages — pas d'emplacement, coût jamais réduit même vendu ────────────

  it('additionne le prix d\'un avantage au prix de base, sans consommer d\'emplacement', () => {
    const vehicle = buildVehicle([], [], [buildAdvantage('expertise', 3)]);
    const summary: VehicleSummary = buildVehicleSummary(vehicle, mockCatalog);

    expect(summary.cout).toBe(18); // 15 (camion) + 3 (expertise)
    expect(summary.emplacementsUtilises).toBe(0);
    expect(summary.equipements).toContain('Expertise');
  });

  it('un avantage vendu reste comptabilisé dans le coût (perte totale, aucun remboursement) mais disparaît des tags', () => {
    const vehicle = buildVehicle([], [], [buildAdvantage('expertise', 3, true)]);
    const summary: VehicleSummary = buildVehicleSummary(vehicle, mockCatalog);

    expect(summary.cout).toBe(18); // 15 + 3 — jamais réduit, contrairement à une arme/amélioration vendue
    expect(summary.equipements).not.toContain('Expertise');
  });
});
