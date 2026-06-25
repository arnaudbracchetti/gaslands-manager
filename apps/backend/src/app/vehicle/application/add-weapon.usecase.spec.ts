import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AddWeaponUseCase } from './add-weapon.usecase';
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
  emplacement: 1, description: '', regles: '', sponsors_autorises: ['Rutherford'],
};

function makeVehicle(): Vehicle {
  return new Vehicle(1, 10, 'Rutherford', VehicleType.from(rawBuggy), [], []);
}

function makeRepos(overrides?: {
  vehicle?: Vehicle;
  getWeaponType?: ReturnType<typeof vi.fn>;
  getWeaponTypesForSponsor?: ReturnType<typeof vi.fn>;
  remainingBudget?: number;
}): { vehicleRepo: IVehicleRepository; catalogRepo: ICatalogRepository } {
  const vehicleRepo: IVehicleRepository = {
    findByWeaponId: vi.fn().mockResolvedValue(null),
      findByIdForUser: vi.fn().mockResolvedValue(overrides?.vehicle ?? makeVehicle()),
    findAllForTeam: vi.fn(),
    getRemainingBudget: vi.fn().mockResolvedValue(overrides?.remainingBudget ?? 50),
    save: vi.fn().mockImplementation((v: Vehicle) => Promise.resolve(v)),
    remove: vi.fn(),
  };
  const catalogRepo: ICatalogRepository = {
    getVehicleType: vi.fn(),
    getWeaponType: overrides?.getWeaponType ?? vi.fn().mockReturnValue(WeaponType.from(rawMitrailleuse)),
    getImprovementType: vi.fn(),
    getVehicleTypesForSponsor: vi.fn(),
    getWeaponTypesForSponsor: overrides?.getWeaponTypesForSponsor ?? vi.fn().mockReturnValue([WeaponType.from(rawMitrailleuse)]),
    getImprovementTypesForSponsor: vi.fn(),
  };
  return { vehicleRepo, catalogRepo };
}

describe('AddWeaponUseCase', () => {
  let usecase: AddWeaponUseCase;
  let vehicleRepo: IVehicleRepository;

  beforeEach(() => {
    const repos = makeRepos();
    vehicleRepo = repos.vehicleRepo;
    usecase = new AddWeaponUseCase(repos.vehicleRepo, repos.catalogRepo);
  });

  it("ajoute une arme si tout est valide", async () => {
    await usecase.execute({ vehicleId: 1, nomInterne: 'mitrailleuse', orientation: 'avant', userId: 1 });
    expect(vehicleRepo.save).toHaveBeenCalled();
  });

  it("lève BadRequestException si l'arme est inconnue du catalogue", async () => {
    const { vehicleRepo: vr, catalogRepo: cr } = makeRepos({
      getWeaponType: vi.fn().mockReturnValue(undefined),
    });
    const uc = new AddWeaponUseCase(vr, cr);
    await expect(uc.execute({ vehicleId: 1, nomInterne: 'inconnu', orientation: 'avant', userId: 1 }))
      .rejects.toThrow(BadRequestException);
  });

  it("lève BadRequestException si l'arme n'est pas autorisée par le sponsor", async () => {
    const { vehicleRepo: vr, catalogRepo: cr } = makeRepos({
      getWeaponTypesForSponsor: vi.fn().mockReturnValue([]),
    });
    const uc = new AddWeaponUseCase(vr, cr);
    await expect(uc.execute({ vehicleId: 1, nomInterne: 'mitrailleuse', orientation: 'avant', userId: 1 }))
      .rejects.toThrow(BadRequestException);
  });

  it("lève BadRequestException si la règle métier est violée (budget insuffisant)", async () => {
    const { vehicleRepo: vr, catalogRepo: cr } = makeRepos({ remainingBudget: 0 });
    const uc = new AddWeaponUseCase(vr, cr);
    await expect(uc.execute({ vehicleId: 1, nomInterne: 'mitrailleuse', orientation: 'avant', userId: 1 }))
      .rejects.toThrow(BadRequestException);
  });
});
