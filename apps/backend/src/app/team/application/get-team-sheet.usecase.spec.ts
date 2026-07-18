import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { GetTeamSheetUseCase } from './get-team-sheet.usecase';
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
    findByIdForUser: vi.fn().mockResolvedValue(team),
  } as unknown as ITeamRepository;
}

describe('GetTeamSheetUseCase', () => {
  it('génère la fiche HTML pour une équipe non verrouillée', async () => {
    const vehicle = new Vehicle(10, 1, makeVehicleType(), [], []);
    const team = new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, [vehicle]);
    const useCase = new GetTeamSheetUseCase(makeRepo(team));

    const html = await useCase.execute({ teamId: 1, userId: 42 });

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Les Furieux');
    expect(html).toContain('Voiture');
  });

  it('rejette avec BadRequestException (400) si l\'équipe est verrouillée par une campagne', async () => {
    const vehicle = new Vehicle(10, 1, makeVehicleType(), [], []);
    const team = new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, [vehicle], true);
    const useCase = new GetTeamSheetUseCase(makeRepo(team));

    await expect(useCase.execute({ teamId: 1, userId: 42 })).rejects.toThrow(BadRequestException);
  });
});
