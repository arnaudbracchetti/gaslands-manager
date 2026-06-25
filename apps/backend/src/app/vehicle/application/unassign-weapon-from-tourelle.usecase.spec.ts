import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { UnassignWeaponFromTourelleUseCase } from './unassign-weapon-from-tourelle.usecase';
import type { IVehicleRepository } from '../domain/vehicle.repository.interface';
import type { ICatalogRepository } from '../domain/catalog.repository.interface';
import { Vehicle } from '../domain/vehicle';
import { Improvement } from '../domain/improvement';
import { VehicleType } from '../domain/value-objects/vehicle-type';
import { WeaponType } from '../domain/value-objects/weapon-type';
import { ImprovementType } from '../domain/value-objects/improvement-type';
import type { Vehicule, Arme, Amelioration } from '../../catalog/catalog.interfaces';

const rawBuggy: Vehicule = {
  nom: 'Buggy', nom_interne: 'buggy', poids: 'Léger', carrosserie: 6,
  manoeuvrabilite: 4, vitesse_max: 6, equipage: 2, emplacements: 4, prix: 8,
  description: '', regles: '', sponsors_autorises: ['Rutherford'], ameliorations_defaut: [],
};
const rawTourelle: Amelioration = {
  nom: 'Tourelle', nom_interne: 'tourelle', prix: 'x3', emplacement: 0,
  description: '', regles: '', sponsors_autorises: ['Rutherford'],
};
const rawMitrailleuse: Arme = {
  nom: 'Mitrailleuse', nom_interne: 'mitrailleuse', type: 'base', prix: 4,
  emplacement: 1, description: '', regles: '', sponsors_autorises: ['Rutherford'],
};

const emptyCatalog: ICatalogRepository = {
  getVehicleType: vi.fn(), getWeaponType: vi.fn(), getImprovementType: vi.fn(),
  getVehicleTypesForSponsor: vi.fn(), getWeaponTypesForSponsor: vi.fn(), getImprovementTypesForSponsor: vi.fn(),
};

describe('UnassignWeaponFromTourelleUseCase', () => {
  it("désassigne l'arme d'une Tourelle et persiste", async () => {
    const tourelleType = ImprovementType.from(rawTourelle);
    const tourelle = new Improvement(5, tourelleType, null, false);
    tourelle.assignWeapon(WeaponType.from(rawMitrailleuse));
    const vehicle = new Vehicle(1, 10, 'Rutherford', VehicleType.from(rawBuggy), [], [tourelle]);
    const vehicleRepo: IVehicleRepository = {
      findByWeaponId: vi.fn().mockResolvedValue(null),
      findByIdForUser: vi.fn().mockResolvedValue(vehicle),
      findAllForTeam: vi.fn(), getRemainingBudget: vi.fn(),
      save: vi.fn().mockImplementation((v: Vehicle) => Promise.resolve(v)),
      remove: vi.fn(),
    };
    const uc = new UnassignWeaponFromTourelleUseCase(vehicleRepo, emptyCatalog);
    await uc.execute({ vehicleId: 1, improvementId: 5, userId: 1 });
    expect(vehicleRepo.save).toHaveBeenCalled();
  });

  it("lève BadRequestException si l'amélioration n'est pas une Tourelle", async () => {
    const nonTourelle = new Improvement(99, ImprovementType.from({
      nom: 'Bélier', nom_interne: 'belier', prix: 4, emplacement: 1,
      description: '', regles: '', sponsors_autorises: [],
    }), null, false);
    const vehicle = new Vehicle(1, 10, 'Rutherford', VehicleType.from(rawBuggy), [], [nonTourelle]);
    const vehicleRepo: IVehicleRepository = {
      findByWeaponId: vi.fn().mockResolvedValue(null),
      findByIdForUser: vi.fn().mockResolvedValue(vehicle),
      findAllForTeam: vi.fn(), getRemainingBudget: vi.fn(),
      save: vi.fn(), remove: vi.fn(),
    };
    const uc = new UnassignWeaponFromTourelleUseCase(vehicleRepo, emptyCatalog);
    await expect(uc.execute({ vehicleId: 1, improvementId: 99, userId: 1 }))
      .rejects.toThrow(BadRequestException);
  });
});
