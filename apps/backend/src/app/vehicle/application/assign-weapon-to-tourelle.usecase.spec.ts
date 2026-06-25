import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { AssignWeaponToTourelleUseCase } from './assign-weapon-to-tourelle.usecase';
import type { IVehicleRepository } from '../domain/vehicle.repository.interface';
import type { ICatalogRepository } from '../domain/catalog.repository.interface';
import { Vehicle } from '../domain/vehicle';
import { Improvement } from '../domain/improvement';
import { Weapon } from '../domain/weapon';
import { VehicleType } from '../domain/value-objects/vehicle-type';
import { WeaponType } from '../domain/value-objects/weapon-type';
import { ImprovementType } from '../domain/value-objects/improvement-type';
import type { Vehicule, Arme, Amelioration } from '../../catalog/catalog.interfaces';

const rawBuggy: Vehicule = {
  nom: 'Buggy', nom_interne: 'buggy', poids: 'Léger', carrosserie: 6,
  manoeuvrabilite: 4, vitesse_max: 6, equipage: 2, emplacements: 4, prix: 8,
  description: '', regles: '', sponsors_autorises: ['Rutherford'], ameliorations_defaut: [],
};
const rawMitrailleuse: Arme = {
  nom: 'Mitrailleuse', nom_interne: 'mitrailleuse', type: 'base', prix: 4,
  emplacement: 1, description: '', regles: '', sponsors_autorises: ['Rutherford'],
};
const rawTourelle: Amelioration = {
  nom: 'Tourelle', nom_interne: 'tourelle', prix: 'x3', emplacement: 0,
  description: '', regles: '', sponsors_autorises: ['Rutherford'],
};

const tourelle = new Improvement(5, ImprovementType.from(rawTourelle), null, false);

function makeVehicleWithTourelle(): Vehicle {
  return new Vehicle(1, 10, 'Rutherford', VehicleType.from(rawBuggy), [], [tourelle]);
}

function makeRepos(overrides?: {
  getWeaponType?: ReturnType<typeof vi.fn>;
  getWeaponTypesForSponsor?: ReturnType<typeof vi.fn>;
}): { vehicleRepo: IVehicleRepository; catalogRepo: ICatalogRepository } {
  return {
    vehicleRepo: {
      findByWeaponId: vi.fn().mockResolvedValue(null),
      findByIdForUser: vi.fn().mockResolvedValue(makeVehicleWithTourelle()),
      findAllForTeam: vi.fn(), getRemainingBudget: vi.fn().mockResolvedValue(50),
      save: vi.fn().mockImplementation((v: Vehicle) => Promise.resolve(v)),
      remove: vi.fn(),
    },
    catalogRepo: {
      getVehicleType: vi.fn(),
      getWeaponType: overrides?.getWeaponType ?? vi.fn().mockReturnValue(WeaponType.from(rawMitrailleuse)),
      getImprovementType: vi.fn(), getVehicleTypesForSponsor: vi.fn(),
      getWeaponTypesForSponsor: overrides?.getWeaponTypesForSponsor ?? vi.fn().mockReturnValue([WeaponType.from(rawMitrailleuse)]),
      getImprovementTypesForSponsor: vi.fn(),
    },
  };
}

describe('AssignWeaponToTourelleUseCase', () => {
  it("assigne une arme à la Tourelle et persiste", async () => {
    const { vehicleRepo, catalogRepo } = makeRepos();
    const uc = new AssignWeaponToTourelleUseCase(vehicleRepo, catalogRepo);
    await uc.execute({ vehicleId: 1, improvementId: 5, weaponNomInterne: 'mitrailleuse', userId: 1 });
    expect(vehicleRepo.save).toHaveBeenCalled();
  });

  it("lève BadRequestException si l'arme est inconnue", async () => {
    const { vehicleRepo, catalogRepo } = makeRepos({
      getWeaponType: vi.fn().mockReturnValue(undefined),
    });
    const uc = new AssignWeaponToTourelleUseCase(vehicleRepo, catalogRepo);
    await expect(uc.execute({ vehicleId: 1, improvementId: 5, weaponNomInterne: 'inconnu', userId: 1 }))
      .rejects.toThrow(BadRequestException);
  });

  it("lève BadRequestException si l'arme n'est pas autorisée par le sponsor", async () => {
    const { vehicleRepo, catalogRepo } = makeRepos({
      getWeaponTypesForSponsor: vi.fn().mockReturnValue([]),
    });
    const uc = new AssignWeaponToTourelleUseCase(vehicleRepo, catalogRepo);
    await expect(uc.execute({ vehicleId: 1, improvementId: 5, weaponNomInterne: 'mitrailleuse', userId: 1 }))
      .rejects.toThrow(BadRequestException);
  });

  it("lève BadRequestException si le budget de l'équipe est insuffisant (coût ×3)", async () => {
    // Mitrailleuse à 4 → Tourelle = 12. Budget restant 10 → dépassement.
    const freshTourelle = new Improvement(5, ImprovementType.from(rawTourelle), null, false);
    const vehicle = new Vehicle(1, 10, 'Rutherford', VehicleType.from(rawBuggy), [], [freshTourelle]);
    const { vehicleRepo, catalogRepo } = makeRepos();
    (vehicleRepo.findByIdForUser as ReturnType<typeof vi.fn>).mockResolvedValue(vehicle);
    (vehicleRepo.getRemainingBudget as ReturnType<typeof vi.fn>).mockResolvedValue(10);
    const uc = new AssignWeaponToTourelleUseCase(vehicleRepo, catalogRepo);
    await expect(uc.execute({ vehicleId: 1, improvementId: 5, weaponNomInterne: 'mitrailleuse', userId: 1 }))
      .rejects.toThrow(BadRequestException);
    expect(vehicleRepo.save).not.toHaveBeenCalled();
  });

  it("lève BadRequestException si l'amélioration n'est pas une Tourelle", async () => {
    const nonTourelle = new Improvement(99, ImprovementType.from({
      nom: 'Bélier', nom_interne: 'belier', prix: 4, emplacement: 1,
      description: '', regles: '', sponsors_autorises: [],
    }), null, false);
    const vehicle = new Vehicle(1, 10, 'Rutherford', VehicleType.from(rawBuggy), [], [nonTourelle]);
    const { vehicleRepo, catalogRepo } = makeRepos();
    (vehicleRepo.findByIdForUser as ReturnType<typeof vi.fn>).mockResolvedValue(vehicle);
    const uc = new AssignWeaponToTourelleUseCase(vehicleRepo, catalogRepo);
    await expect(uc.execute({ vehicleId: 1, improvementId: 99, weaponNomInterne: 'mitrailleuse', userId: 1 }))
      .rejects.toThrow(BadRequestException);
  });
});
