import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { RemoveImprovementUseCase } from './remove-improvement.usecase';
import type { ITeamRepository } from '../domain/team.repository.interface';
import { Team } from '../domain/team';
import { Vehicle } from '../domain/vehicle';
import { Improvement } from '../domain/improvement';
import { ImprovementType } from '../domain/value-objects/improvement-type';
import { VehicleType } from '../domain/value-objects/vehicle-type';

function makeVehicleType(): VehicleType {
  return VehicleType.from({
    nom: 'Voiture', nom_interne: 'voiture', poids: 'Moyen',
    carrosserie: 6, manoeuvrabilite: 4, vitesse_max: 6, equipage: 2,
    emplacements: 4, prix: 12, description: '', regles: '', sponsors_autorises: [],
  });
}

function makeImprovementType(): ImprovementType {
  return ImprovementType.from({
    nom: 'Blindage', nom_interne: 'blindage', prix: 4, emplacement: 1,
    description: '', regles: '', sponsors_autorises: [], necessite_orientation: false,
  });
}

function makeRepo(team: Team): ITeamRepository {
  return {
    findByVehicleId: vi.fn().mockResolvedValue(team),
    save: vi.fn().mockResolvedValue(team),
  } as unknown as ITeamRepository;
}

/**
 * Régression : ce use case levait autrefois un ForbiddenException (403) via un
 * contrôle `estDefaut` dupliqué en amont de l'agrégat, au lieu de laisser
 * `Vehicle.removeImprovement` lever sa DomainException (400) - comme pour une arme
 * (`RemoveWeaponUseCase`). Cf. mémoire [[feedback_business_rules_in_domain_only]].
 */
describe('RemoveImprovementUseCase', () => {
  it('rejette avec BadRequestException (400), pas ForbiddenException, pour une amélioration estDefaut', async () => {
    const arceaux = new Improvement(1, makeImprovementType(), null, true);
    const vehicle = new Vehicle(10, 1, makeVehicleType(), [], [arceaux]);
    const team = new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, [vehicle]);
    const useCase = new RemoveImprovementUseCase(makeRepo(team));

    await expect(useCase.execute({ vehicleId: 10, improvementId: 1, userId: 42 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejette avec BadRequestException si l\'amélioration est introuvable (aucun pré-contrôle dupliqué)', async () => {
    const vehicle = new Vehicle(10, 1, makeVehicleType(), [], []);
    const team = new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, [vehicle]);
    const useCase = new RemoveImprovementUseCase(makeRepo(team));

    await expect(useCase.execute({ vehicleId: 10, improvementId: 999, userId: 42 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('retire normalement une amélioration achetée (estDefaut: false)', async () => {
    const belier = new Improvement(1, makeImprovementType(), null, false);
    const vehicle = new Vehicle(10, 1, makeVehicleType(), [], [belier]);
    const team = new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, [vehicle]);
    const repo = makeRepo(team);
    const useCase = new RemoveImprovementUseCase(repo);

    const result = await useCase.execute({ vehicleId: 10, improvementId: 1, userId: 42 });

    expect(result.improvements).toHaveLength(0);
    expect(repo.save).toHaveBeenCalledWith(team);
  });
});
