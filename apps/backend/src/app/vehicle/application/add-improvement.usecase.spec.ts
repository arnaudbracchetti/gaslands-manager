import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { AddImprovementUseCase } from './add-improvement.usecase';
import type { IVehicleRepository } from '../domain/vehicle.repository.interface';
import type { ICatalogRepository } from '../domain/catalog.repository.interface';
import { Vehicle } from '../domain/vehicle';
import { VehicleType } from '../domain/value-objects/vehicle-type';
import { ImprovementType } from '../domain/value-objects/improvement-type';
import type { Vehicule, Amelioration } from '../../catalog/catalog.interfaces';

const rawBuggy: Vehicule = {
  nom: 'Buggy', nom_interne: 'buggy', poids: 'Léger', carrosserie: 6,
  manoeuvrabilite: 4, vitesse_max: 6, equipage: 2, emplacements: 4, prix: 8,
  description: '', regles: '', sponsors_autorises: ['Rutherford'], ameliorations_defaut: [],
};
const rawBelier: Amelioration = {
  nom: 'Bélier', nom_interne: 'belier', prix: 4, emplacement: 1,
  description: '', regles: '', sponsors_autorises: ['Rutherford'], comportement: 'belier',
};

function makeVehicle(): Vehicle {
  return new Vehicle(1, 10, 'Rutherford', VehicleType.from(rawBuggy), [], []);
}

function makeRepos(overrides?: {
  getImprovementType?: ReturnType<typeof vi.fn>;
  getImprovementTypesForSponsor?: ReturnType<typeof vi.fn>;
  remainingBudget?: number;
}): { vehicleRepo: IVehicleRepository; catalogRepo: ICatalogRepository } {
  return {
    vehicleRepo: {
      findByWeaponId: vi.fn().mockResolvedValue(null),
      findByIdForUser: vi.fn().mockResolvedValue(makeVehicle()),
      findAllForTeam: vi.fn(),
      getRemainingBudget: vi.fn().mockResolvedValue(overrides?.remainingBudget ?? 50),
      save: vi.fn().mockImplementation((v: Vehicle) => Promise.resolve(v)),
      remove: vi.fn(),
    },
    catalogRepo: {
      getVehicleType: vi.fn(), getWeaponType: vi.fn(),
      getImprovementType: overrides?.getImprovementType ?? vi.fn().mockReturnValue(ImprovementType.from(rawBelier)),
      getVehicleTypesForSponsor: vi.fn(), getWeaponTypesForSponsor: vi.fn(),
      getImprovementTypesForSponsor: overrides?.getImprovementTypesForSponsor ?? vi.fn().mockReturnValue([ImprovementType.from(rawBelier)]),
    },
  };
}

describe('AddImprovementUseCase', () => {
  let usecase: AddImprovementUseCase;
  let vehicleRepo: IVehicleRepository;

  beforeEach(() => {
    const { vehicleRepo: vr, catalogRepo: cr } = makeRepos();
    vehicleRepo = vr;
    usecase = new AddImprovementUseCase(vr, cr);
  });

  it("ajoute une amélioration si tout est valide", async () => {
    await usecase.execute({ vehicleId: 1, nomInterne: 'belier', orientation: 'avant', userId: 1 });
    expect(vehicleRepo.save).toHaveBeenCalled();
  });

  it("lève BadRequestException si l'amélioration est inconnue du catalogue", async () => {
    const { vehicleRepo: vr, catalogRepo: cr } = makeRepos({
      getImprovementType: vi.fn().mockReturnValue(undefined),
    });
    await expect(new AddImprovementUseCase(vr, cr).execute({ vehicleId: 1, nomInterne: 'inconnu', orientation: null, userId: 1 }))
      .rejects.toThrow(BadRequestException);
  });

  it("lève BadRequestException si l'amélioration n'est pas autorisée par le sponsor", async () => {
    const { vehicleRepo: vr, catalogRepo: cr } = makeRepos({
      getImprovementTypesForSponsor: vi.fn().mockReturnValue([]),
    });
    await expect(new AddImprovementUseCase(vr, cr).execute({ vehicleId: 1, nomInterne: 'belier', orientation: null, userId: 1 }))
      .rejects.toThrow(BadRequestException);
  });

  it("lève BadRequestException si le budget est insuffisant", async () => {
    const { vehicleRepo: vr, catalogRepo: cr } = makeRepos({ remainingBudget: 0 });
    await expect(new AddImprovementUseCase(vr, cr).execute({ vehicleId: 1, nomInterne: 'belier', orientation: null, userId: 1 }))
      .rejects.toThrow(BadRequestException);
  });
});
