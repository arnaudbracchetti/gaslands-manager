import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { RenameVehicleUseCase } from './rename-vehicle.usecase';
import type { ITeamRepository } from '../domain/team.repository.interface';
import { Team } from '../domain/team';
import { Vehicle } from '../domain/vehicle';
import { VehicleType } from '../domain/value-objects/vehicle-type';

function makeVehicleType(): VehicleType {
  return VehicleType.from({
    nom: 'Voiture', nom_interne: 'voiture', poids: 'Moyen',
    carrosserie: 6, manoeuvrabilite: 4, vitesse_max: 6, equipage: 2,
    emplacements: 4, prix: 12, description: '', regles: '', sponsors_autorises: [],
  });
}

function makeRepo(team: Team): ITeamRepository {
  return {
    findByVehicleId: vi.fn().mockResolvedValue(team),
    save: vi.fn().mockResolvedValue(team),
  } as unknown as ITeamRepository;
}

describe('RenameVehicleUseCase', () => {
  it('renomme normalement un véhicule quand l\'équipe est déverrouillée', async () => {
    const vehicle = new Vehicle(10, 1, makeVehicleType(), [], []);
    const team = new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, [vehicle]);
    const useCase = new RenameVehicleUseCase(makeRepo(team));

    const result = await useCase.execute({ vehicleId: 10, nom: 'La Teigne', userId: 42 });

    expect(result.findVehicle(10).nom).toBe('La Teigne (Voiture)');
  });

  it('rejette avec BadRequestException (400) si l\'équipe est verrouillée', async () => {
    const vehicle = new Vehicle(10, 1, makeVehicleType(), [], []);
    const team = new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, [vehicle], true);
    const useCase = new RenameVehicleUseCase(makeRepo(team));

    await expect(useCase.execute({ vehicleId: 10, nom: 'La Teigne', userId: 42 })).rejects.toThrow(BadRequestException);
  });

  it('rejette avec BadRequestException (400) pour un nom vide', async () => {
    const vehicle = new Vehicle(10, 1, makeVehicleType(), [], []);
    const team = new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, [vehicle]);
    const useCase = new RenameVehicleUseCase(makeRepo(team));

    await expect(useCase.execute({ vehicleId: 10, nom: '   ', userId: 42 })).rejects.toThrow(BadRequestException);
  });
});
