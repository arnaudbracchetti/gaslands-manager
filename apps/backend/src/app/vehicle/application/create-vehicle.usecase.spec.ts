import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateVehicleUseCase } from './create-vehicle.usecase';
import type { IVehicleRepository } from '../domain/vehicle.repository.interface';
import type { ICatalogRepository } from '../domain/catalog.repository.interface';
import { Vehicle } from '../domain/vehicle';
import { VehicleType } from '../domain/value-objects/vehicle-type';
import type { Vehicule } from '../../catalog/catalog.interfaces';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const rawBuggy: Vehicule = {
  nom: 'Buggy',
  nom_interne: 'buggy',
  poids: 'Léger',
  carrosserie: 6,
  manoeuvrabilite: 4,
  vitesse_max: 6,
  equipage: 2,
  emplacements: 4,
  prix: 8,
  description: '',
  regles: '',
  sponsors_autorises: ['Rutherford'],
  ameliorations_defaut: [],
};

function makeVehicle(): Vehicle {
  return new Vehicle(1, 10, 'Rutherford', VehicleType.from(rawBuggy), [], []);
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

function makeRepos(overrides?: {
  getVehicleTypesForSponsor?: ReturnType<typeof vi.fn>;
  getVehicleType?: ReturnType<typeof vi.fn>;
  save?: ReturnType<typeof vi.fn>;
}): { vehicleRepo: IVehicleRepository; catalogRepo: ICatalogRepository } {
  const vehicleRepo: IVehicleRepository = {
    findByWeaponId: vi.fn().mockResolvedValue(null),
      findByIdForUser: vi.fn(),
    findAllForTeam: vi.fn(),
    getRemainingBudget: vi.fn(),
    save: overrides?.save ?? vi.fn().mockResolvedValue(makeVehicle()),
    remove: vi.fn(),
  };
  const catalogRepo: ICatalogRepository = {
    getVehicleType: overrides?.getVehicleType ?? vi.fn().mockReturnValue(VehicleType.from(rawBuggy)),
    getWeaponType: vi.fn(),
    getImprovementType: vi.fn(),
    getVehicleTypesForSponsor: overrides?.getVehicleTypesForSponsor ?? vi.fn().mockReturnValue([VehicleType.from(rawBuggy)]),
    getWeaponTypesForSponsor: vi.fn(),
    getImprovementTypesForSponsor: vi.fn(),
  };
  return { vehicleRepo, catalogRepo };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CreateVehicleUseCase', () => {
  let usecase: CreateVehicleUseCase;
  let vehicleRepo: IVehicleRepository;
  let catalogRepo: ICatalogRepository;

  beforeEach(() => {
    const repos = makeRepos();
    vehicleRepo = repos.vehicleRepo;
    catalogRepo = repos.catalogRepo;
    usecase = new CreateVehicleUseCase(vehicleRepo, catalogRepo);
  });

  it('crée et retourne le véhicule si nomInterne autorisé par le sponsor', async () => {
    const result = await usecase.execute({
      teamId: 10,
      sponsorNom: 'Rutherford',
      nomInterne: 'buggy',
      userId: 1,
    });
    expect(vehicleRepo.save).toHaveBeenCalled();
    expect(result.type.nomInterne).toBe('buggy');
  });

  it("lève BadRequestException si le véhicule est inconnu du catalogue", async () => {
    const { vehicleRepo: vr, catalogRepo: cr } = makeRepos({
      getVehicleType: vi.fn().mockReturnValue(undefined),
    });
    const uc = new CreateVehicleUseCase(vr, cr);
    await expect(uc.execute({ teamId: 10, sponsorNom: 'Rutherford', nomInterne: 'inconnu', userId: 1 }))
      .rejects.toThrow(BadRequestException);
  });

  it("lève BadRequestException si le véhicule n'est pas autorisé par le sponsor", async () => {
    const { vehicleRepo: vr, catalogRepo: cr } = makeRepos({
      getVehicleTypesForSponsor: vi.fn().mockReturnValue([]), // aucun véhicule autorisé
    });
    const uc = new CreateVehicleUseCase(vr, cr);
    await expect(uc.execute({ teamId: 10, sponsorNom: 'Rutherford', nomInterne: 'buggy', userId: 1 }))
      .rejects.toThrow(BadRequestException);
  });
});
