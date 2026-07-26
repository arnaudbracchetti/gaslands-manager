/**
 * Tests unitaires pour `buildVehicleSaleSummary` (fonction pure).
 *
 * Même esprit que `teams/vehicle-summary.spec.ts` : pas de TestBed, fixtures
 * construites à la main directement au format `WorkshopVehicleDto`.
 */
import { buildVehicleSaleSummary, VehicleSaleSummary } from './vehicle-sale-summary';
import { WorkshopVehicleDto, WorkshopWeaponDto, WorkshopImprovementDto, WorkshopAdvantageDto } from '../workshop.model';
import { Sponsor, Vehicule, Arme, Amelioration, Avantage } from '../../catalog/catalog.model';

const mockVehiculeCatalogue: Vehicule = {
  nom: 'Camion', nom_interne: 'camion', poids: 'Moyen',
  carrosserie: 0, manoeuvrabilite: 0, vitesse_max: 0, equipage: 0,
  emplacements: 3, prix: 12, description: '', regles: '', sponsors_autorises: [],
};

const mockMitrailleuse: Arme = {
  nom: 'Mitrailleuse', nom_interne: 'mitrailleuse', type: 'base',
  prix: 5, emplacement: 1, description: '', regles: '', sponsors_autorises: [],
  necessite_orientation: true,
};

const mockBlindage: Amelioration = {
  nom: 'Blindage', nom_interne: 'blindage', prix: 4, emplacement: 1,
  description: '', regles: '', sponsors_autorises: [], necessite_orientation: false,
};

const mockExpertise: Avantage = {
  nom: 'Expertise', nom_interne: 'expertise', categorie: 'Précision', prix: 3,
  description: '', regles: '',
};

const mockCatalog: Sponsor = {
  nom: 'Rutherford', description: '', classes_avantage: [], avantages_sponsorises: '',
  vehicules: [mockVehiculeCatalogue], armes: [mockMitrailleuse], ameliorations: [mockBlindage],
  avantages: [mockExpertise],
};

function buildWeapon(overrides: Partial<WorkshopWeaponDto> = {}): WorkshopWeaponDto {
  return {
    id: 1, nomInterne: 'mitrailleuse', orientation: 'avant', price: 5, emplacement: 1,
    estDefaut: false, isLost: false, isSold: false, purchasedThisSession: false, resaleRefund: 2,
    ...overrides,
  };
}

function buildImprovement(overrides: Partial<WorkshopImprovementDto> = {}): WorkshopImprovementDto {
  return {
    id: 1, nomInterne: 'blindage', orientation: null, price: 4, emplacement: 1,
    estDefaut: false, isLost: false, isSold: false, purchasedThisSession: false, resaleRefund: 2,
    ...overrides,
  };
}

function buildAdvantage(overrides: Partial<WorkshopAdvantageDto> = {}): WorkshopAdvantageDto {
  return {
    id: 1, nomInterne: 'expertise', price: 3, isLost: false, isSold: false, purchasedThisSession: false,
    resaleRefund: 0,
    ...overrides,
  };
}

function buildVehicle(overrides: Partial<WorkshopVehicleDto> = {}): WorkshopVehicleDto {
  return {
    id: 1, nomInterne: 'camion', nom: 'Camion', customName: null, price: 12, isLost: false, chocs: 0, sequellas: [],
    weapons: [], improvements: [], advantages: [], resaleRefund: 6, chassisResaleRefund: 6, purchasedThisSession: false,
    emplacementsTotal: 3,
    ...overrides,
  };
}

describe('buildVehicleSaleSummary', () => {
  it('résout le nom depuis le catalogue et reporte le prix châssis', () => {
    const summary: VehicleSaleSummary = buildVehicleSaleSummary(buildVehicle(), mockCatalog);

    expect(summary.vehicleName).toBe('Camion');
    expect(summary.chassisPrice).toBe(12);
  });

  it('un véhicule nu : totalCost = prix châssis seul, aucune ligne', () => {
    const summary = buildVehicleSaleSummary(buildVehicle(), mockCatalog);

    expect(summary.items).toEqual([]);
    expect(summary.totalCost).toBe(12);
  });

  it('inclut les armes/améliorations/avantages ACTIFS dans le détail et le total', () => {
    const vehicle = buildVehicle({
      weapons: [buildWeapon()],
      improvements: [buildImprovement()],
      advantages: [buildAdvantage()],
    });
    const summary = buildVehicleSaleSummary(vehicle, mockCatalog);

    expect(summary.items).toHaveLength(3);
    expect(summary.items.map((i) => i.label)).toEqual(['Mitrailleuse', 'Blindage', 'Expertise']);
    expect(summary.totalCost).toBe(12 + 5 + 4 + 3);
  });

  it('reporte le montant de vente (resaleRefund backend) par ligne, jamais recalculé côté client', () => {
    const vehicle = buildVehicle({
      weapons: [buildWeapon({ resaleRefund: 2 })],
      improvements: [buildImprovement({ resaleRefund: 2 })],
      advantages: [buildAdvantage({ resaleRefund: 0 })],
      chassisResaleRefund: 6,
    });
    const summary = buildVehicleSaleSummary(vehicle, mockCatalog);

    expect(summary.chassisRefund).toBe(6);
    expect(summary.items.map((i) => i.refund)).toEqual([2, 2, 0]);
  });

  it('exclut les armes/améliorations/avantages estDefaut, vendus ou perdus du détail', () => {
    const vehicle = buildVehicle({
      weapons: [buildWeapon({ estDefaut: true }), buildWeapon({ isSold: true }), buildWeapon({ isLost: true })],
      improvements: [buildImprovement({ estDefaut: true })],
      advantages: [buildAdvantage({ isSold: true })],
    });
    const summary = buildVehicleSaleSummary(vehicle, mockCatalog);

    expect(summary.items).toEqual([]);
    expect(summary.totalCost).toBe(12); // châssis seul
  });

  it('reporte le remboursement backend tel quel (jamais recalculé côté client)', () => {
    const vehicle = buildVehicle({ resaleRefund: 10 });
    const summary = buildVehicleSaleSummary(vehicle, mockCatalog);

    expect(summary.refund).toBe(10);
  });

  it('reporte purchasedThisSession tel quel depuis le DTO backend', () => {
    const summary = buildVehicleSaleSummary(buildVehicle({ purchasedThisSession: true }), mockCatalog);

    expect(summary.purchasedThisSession).toBe(true);
  });

  it('chassisPrice se rabat sur le prix du DTO atelier si le véhicule est introuvable dans le catalogue', () => {
    const summary = buildVehicleSaleSummary(buildVehicle({ nomInterne: 'inconnu' }), mockCatalog);

    // vehicleName = vehicle.nom, déjà résolu/formaté côté backend — jamais affecté
    // par un échec de recherche catalogue (seul chassisPrice en dépend encore).
    expect(summary.vehicleName).toBe('Camion');
    expect(summary.chassisPrice).toBe(12); // repli sur le prix du DTO atelier
  });
});
