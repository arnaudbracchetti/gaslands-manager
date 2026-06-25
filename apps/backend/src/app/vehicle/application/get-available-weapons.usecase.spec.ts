import { describe, it, expect, vi } from 'vitest';
import { GetAvailableWeaponsUseCase } from './get-available-weapons.usecase';
import type { IVehicleRepository } from '../domain/vehicle.repository.interface';
import type { ICatalogRepository } from '../domain/catalog.repository.interface';
import { Vehicle } from '../domain/vehicle';
import { VehicleType } from '../domain/value-objects/vehicle-type';
import { WeaponType } from '../domain/value-objects/weapon-type';
import type { Vehicule, Arme } from '../../catalog/catalog.interfaces';

const rawBuggy: Vehicule = {
  nom: 'Buggy', nom_interne: 'buggy', poids: 'Léger', carrosserie: 6,
  manoeuvrabilite: 4, vitesse_max: 6, equipage: 2, emplacements: 4, prix: 8,
  description: '', regles: '', sponsors_autorises: ['Rutherford'], ameliorations_defaut: [],
};
const rawMitrailleuse: Arme = {
  nom: 'Mitrailleuse', nom_interne: 'mitrailleuse', type: 'base', prix: 4,
  emplacement: 1, description: 'desc', regles: 'regles', sponsors_autorises: ['Rutherford'],
};
const rawGrenades: Arme = {
  nom: 'Grenades', nom_interne: 'grenades', type: 'équipage', prix: 2,
  emplacement: 0, description: 'desc', regles: 'regles', sponsors_autorises: ['Rutherford'],
};

function makeVehicle(): Vehicle {
  return new Vehicle(1, 10, 'Rutherford', VehicleType.from(rawBuggy), [], []);
}

function makeRepos(remainingBudget = 50): { vehicleRepo: IVehicleRepository; catalogRepo: ICatalogRepository } {
  return {
    vehicleRepo: {
      findByWeaponId: vi.fn().mockResolvedValue(null),
      findByIdForUser: vi.fn().mockResolvedValue(makeVehicle()),
      findAllForTeam: vi.fn(),
      getRemainingBudget: vi.fn().mockResolvedValue(remainingBudget),
      save: vi.fn(), remove: vi.fn(),
    },
    catalogRepo: {
      getVehicleType: vi.fn(), getWeaponType: vi.fn(), getImprovementType: vi.fn(),
      getVehicleTypesForSponsor: vi.fn(),
      getWeaponTypesForSponsor: vi.fn().mockReturnValue([
        WeaponType.from(rawMitrailleuse),
        WeaponType.from(rawGrenades),
      ]),
      getImprovementTypesForSponsor: vi.fn(),
    },
  };
}

describe('GetAvailableWeaponsUseCase', () => {
  it("retourne une liste d'armes avec verdicts de disponibilité", async () => {
    const { vehicleRepo, catalogRepo } = makeRepos();
    const uc = new GetAvailableWeaponsUseCase(vehicleRepo, catalogRepo);
    const result = await uc.execute({ vehicleId: 1, userId: 1 });
    expect(result).toHaveLength(2);
    expect(result[0].nomInterne).toBe('mitrailleuse');
    expect(result[1].nomInterne).toBe('grenades');
  });

  it("marque disponible:true si les règles sont respectées", async () => {
    const { vehicleRepo, catalogRepo } = makeRepos(50);
    const uc = new GetAvailableWeaponsUseCase(vehicleRepo, catalogRepo);
    const result = await uc.execute({ vehicleId: 1, userId: 1 });
    // Grenades (équipage, 0 slot, prix 2) : disponible sans orientation
    expect(result[1].disponible).toBe(true);
  });

  it("marque disponible:false si le budget est insuffisant", async () => {
    const { vehicleRepo, catalogRepo } = makeRepos(0);
    const uc = new GetAvailableWeaponsUseCase(vehicleRepo, catalogRepo);
    const result = await uc.execute({ vehicleId: 1, userId: 1 });
    // Mitrailleuse coûte 4, budget 0 → indisponible
    expect(result[0].disponible).toBe(false);
  });
});
