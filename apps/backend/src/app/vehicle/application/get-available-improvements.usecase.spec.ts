import { describe, it, expect, vi } from 'vitest';
import { GetAvailableImprovementsUseCase } from './get-available-improvements.usecase';
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
  description: 'desc', regles: 'regles', sponsors_autorises: ['Rutherford'], comportement: 'belier',
};
const rawTourelle: Amelioration = {
  nom: 'Tourelle', nom_interne: 'tourelle', prix: 'x3', emplacement: 0,
  description: 'desc', regles: 'regles', sponsors_autorises: ['Rutherford'],
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
      getVehicleTypesForSponsor: vi.fn(), getWeaponTypesForSponsor: vi.fn(),
      getImprovementTypesForSponsor: vi.fn().mockReturnValue([
        ImprovementType.from(rawBelier),
        ImprovementType.from(rawTourelle),
      ]),
    },
  };
}

describe('GetAvailableImprovementsUseCase', () => {
  it("retourne une liste d'améliorations avec verdicts de disponibilité", async () => {
    const { vehicleRepo, catalogRepo } = makeRepos();
    const uc = new GetAvailableImprovementsUseCase(vehicleRepo, catalogRepo);
    const result = await uc.execute({ vehicleId: 1, userId: 1 });
    expect(result).toHaveLength(2);
    expect(result[0].nomInterne).toBe('belier');
    expect(result[1].nomInterne).toBe('tourelle');
  });

  it("marque la Tourelle comme disponible même avec budget 0 (prix variable)", async () => {
    const { vehicleRepo, catalogRepo } = makeRepos(0);
    const uc = new GetAvailableImprovementsUseCase(vehicleRepo, catalogRepo);
    const result = await uc.execute({ vehicleId: 1, userId: 1 });
    const tourelle = result.find((r) => r.nomInterne === 'tourelle');
    expect(tourelle?.disponible).toBe(true);
  });

  it("marque indisponible si budget insuffisant pour une amélioration à prix fixe", async () => {
    const { vehicleRepo, catalogRepo } = makeRepos(0);
    const uc = new GetAvailableImprovementsUseCase(vehicleRepo, catalogRepo);
    const result = await uc.execute({ vehicleId: 1, userId: 1 });
    const belier = result.find((r) => r.nomInterne === 'belier');
    expect(belier?.disponible).toBe(false);
  });
});
