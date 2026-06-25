import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { RemoveWeaponUseCase } from './remove-weapon.usecase';
import type { IVehicleRepository } from '../domain/vehicle.repository.interface';
import type { ICatalogRepository } from '../domain/catalog.repository.interface';
import { Vehicle } from '../domain/vehicle';
import { Weapon } from '../domain/weapon';
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

const mitrailleuse = new Weapon(42, WeaponType.from(rawMitrailleuse), 'avant');

function makeVehicleWithWeapon(): Vehicle {
  return new Vehicle(1, 10, 'Rutherford', VehicleType.from(rawBuggy), [mitrailleuse], []);
}

function makeRepos(vehicle?: Vehicle): { vehicleRepo: IVehicleRepository; catalogRepo: ICatalogRepository } {
  return {
    vehicleRepo: {
      findByIdForUser: vi.fn().mockResolvedValue(vehicle ?? makeVehicleWithWeapon()),
      findByWeaponId: vi.fn().mockResolvedValue(vehicle ?? makeVehicleWithWeapon()),
      findAllForTeam: vi.fn(),
      getRemainingBudget: vi.fn(),
      save: vi.fn().mockImplementation((v: Vehicle) => Promise.resolve(v)),
      remove: vi.fn(),
    },
    catalogRepo: {
      getVehicleType: vi.fn(), getWeaponType: vi.fn(), getImprovementType: vi.fn(),
      getVehicleTypesForSponsor: vi.fn(), getWeaponTypesForSponsor: vi.fn(), getImprovementTypesForSponsor: vi.fn(),
    },
  };
}

describe('RemoveWeaponUseCase', () => {
  let usecase: RemoveWeaponUseCase;
  let vehicleRepo: IVehicleRepository;

  beforeEach(() => {
    const { vehicleRepo: vr, catalogRepo: cr } = makeRepos();
    vehicleRepo = vr;
    usecase = new RemoveWeaponUseCase(vr, cr);
  });

  it("retire l'arme du véhicule et persiste", async () => {
    await usecase.execute({ vehicleId: 1, weaponId: 42, userId: 1 });
    expect(vehicleRepo.save).toHaveBeenCalled();
  });

  it("lève BadRequestException si l'arme est introuvable", async () => {
    const { vehicleRepo: vr, catalogRepo: cr } = makeRepos();
    const uc = new RemoveWeaponUseCase(vr, cr);
    await expect(uc.execute({ vehicleId: 1, weaponId: 999, userId: 1 }))
      .rejects.toThrow(BadRequestException);
  });
});
