import { describe, it, expect, vi } from 'vitest';
import { GetVehicleDetailUseCase } from './get-vehicle-detail.usecase';
import type { IVehicleRepository } from '../domain/vehicle.repository.interface';
import type { ICatalogRepository } from '../domain/catalog.repository.interface';
import { Vehicle } from '../domain/vehicle';
import { VehicleType } from '../domain/value-objects/vehicle-type';
import type { Vehicule } from '../../catalog/catalog.interfaces';
import { VehicleBuildFactory } from '../vehicle-build.factory';
import { ImprovementDecoratorFactory } from '../improvement-decorator.factory';
import { CatalogService } from '../../catalog/catalog.service';

const rawBuggy: Vehicule = {
  nom: 'Buggy', nom_interne: 'buggy', poids: 'Léger', carrosserie: 6,
  manoeuvrabilite: 4, vitesse_max: 6, equipage: 2, emplacements: 4, prix: 8,
  description: '', regles: '', sponsors_autorises: ['Rutherford'], ameliorations_defaut: [],
};

function makeVehicle(): Vehicle {
  return new Vehicle(1, 10, 'Rutherford', VehicleType.from(rawBuggy), [], []);
}

function makeRepos(): { vehicleRepo: IVehicleRepository; catalogRepo: ICatalogRepository } {
  return {
    vehicleRepo: {
      findByWeaponId: vi.fn().mockResolvedValue(null),
      findByIdForUser: vi.fn().mockResolvedValue(makeVehicle()),
      findAllForTeam: vi.fn(), getRemainingBudget: vi.fn(),
      save: vi.fn(), remove: vi.fn(),
    },
    catalogRepo: {
      getVehicleType: vi.fn().mockReturnValue(VehicleType.from(rawBuggy)),
      getWeaponType: vi.fn(), getImprovementType: vi.fn(),
      getVehicleTypesForSponsor: vi.fn(), getWeaponTypesForSponsor: vi.fn(), getImprovementTypesForSponsor: vi.fn(),
    },
  };
}

describe('GetVehicleDetailUseCase', () => {
  it('retourne un VehicleDetailDto avec id, nomInterne, stats, baseStats, recapitulatif', async () => {
    const { vehicleRepo, catalogRepo } = makeRepos();
    // VehicleBuildFactory et ses dépendances : on crée des instances réelles légères
    const catalogSvc = { getVehiculeByNomInterne: vi.fn().mockReturnValue(rawBuggy) } as unknown as CatalogService;
    const decoratorFactory = new ImprovementDecoratorFactory(catalogSvc);
    const buildFactory = new VehicleBuildFactory(catalogSvc, decoratorFactory);

    const uc = new GetVehicleDetailUseCase(vehicleRepo, catalogRepo, buildFactory);
    const result = await uc.execute({ vehicleId: 1, userId: 1 });

    expect(result.id).toBe(1);
    expect(result.nomInterne).toBe('buggy');
    expect(result.stats).toBeDefined();
    expect(result.baseStats).toBeDefined();
    expect(result.recapitulatif).toBeDefined();
  });
});
