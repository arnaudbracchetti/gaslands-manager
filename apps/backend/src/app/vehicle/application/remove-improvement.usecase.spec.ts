import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RemoveImprovementUseCase } from './remove-improvement.usecase';
import type { IVehicleRepository } from '../domain/vehicle.repository.interface';
import type { ICatalogRepository } from '../domain/catalog.repository.interface';
import { Vehicle } from '../domain/vehicle';
import { Improvement } from '../domain/improvement';
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
const rawArceaux: Amelioration = {
  nom: 'Arceaux', nom_interne: 'arceaux', prix: 4, emplacement: 1,
  description: '', regles: '', sponsors_autorises: ['Rutherford'],
};

const belier = new Improvement(10, ImprovementType.from(rawBelier), 'avant', false);
const arceauxDefaut = new Improvement(20, ImprovementType.from(rawArceaux), null, true);

function makeRepo(improvements: Improvement[]): IVehicleRepository {
  const vehicle = new Vehicle(1, 10, 'Rutherford', VehicleType.from(rawBuggy), [], improvements);
  return {
    findByWeaponId: vi.fn().mockResolvedValue(null),
      findByIdForUser: vi.fn().mockResolvedValue(vehicle),
    findAllForTeam: vi.fn(), getRemainingBudget: vi.fn(),
    save: vi.fn().mockImplementation((v: Vehicle) => Promise.resolve(v)),
    remove: vi.fn(),
  };
}
const emptyCatalog: ICatalogRepository = {
  getVehicleType: vi.fn(), getWeaponType: vi.fn(), getImprovementType: vi.fn(),
  getVehicleTypesForSponsor: vi.fn(), getWeaponTypesForSponsor: vi.fn(), getImprovementTypesForSponsor: vi.fn(),
};

describe('RemoveImprovementUseCase', () => {
  it("retire une amélioration achetée et persiste", async () => {
    const vehicleRepo = makeRepo([belier]);
    const uc = new RemoveImprovementUseCase(vehicleRepo, emptyCatalog);
    await uc.execute({ vehicleId: 1, improvementId: 10, userId: 1 });
    expect(vehicleRepo.save).toHaveBeenCalled();
  });

  it("lève ForbiddenException pour une amélioration par défaut", async () => {
    const vehicleRepo = makeRepo([arceauxDefaut]);
    const uc = new RemoveImprovementUseCase(vehicleRepo, emptyCatalog);
    await expect(uc.execute({ vehicleId: 1, improvementId: 20, userId: 1 }))
      .rejects.toThrow(ForbiddenException);
  });

  it("lève BadRequestException si l'amélioration est introuvable", async () => {
    const vehicleRepo = makeRepo([belier]);
    const uc = new RemoveImprovementUseCase(vehicleRepo, emptyCatalog);
    await expect(uc.execute({ vehicleId: 1, improvementId: 999, userId: 1 }))
      .rejects.toThrow(BadRequestException);
  });
});
