import { describe, it, expect, vi } from 'vitest';
import { RemoveVehicleUseCase } from './remove-vehicle.usecase';
import type { IVehicleRepository } from '../domain/vehicle.repository.interface';
import type { ICatalogRepository } from '../domain/catalog.repository.interface';

const emptyCatalog: ICatalogRepository = {
  getVehicleType: vi.fn(), getWeaponType: vi.fn(), getImprovementType: vi.fn(),
  getVehicleTypesForSponsor: vi.fn(), getWeaponTypesForSponsor: vi.fn(), getImprovementTypesForSponsor: vi.fn(),
};

describe('RemoveVehicleUseCase', () => {
  it("supprime le véhicule via le repository", async () => {
    const vehicleRepo: IVehicleRepository = {
      findByWeaponId: vi.fn().mockResolvedValue(null),
      findByIdForUser: vi.fn(), findAllForTeam: vi.fn(), getRemainingBudget: vi.fn(),
      save: vi.fn(),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    const uc = new RemoveVehicleUseCase(vehicleRepo, emptyCatalog);
    await uc.execute({ vehicleId: 1, userId: 1 });
    expect(vehicleRepo.remove).toHaveBeenCalledWith(1, 1);
  });
});
