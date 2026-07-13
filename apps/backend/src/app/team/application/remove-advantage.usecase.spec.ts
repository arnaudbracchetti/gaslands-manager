import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { RemoveAdvantageUseCase } from './remove-advantage.usecase';
import type { ITeamRepository } from '../domain/team.repository.interface';
import { Team } from '../domain/team';
import { Vehicle } from '../domain/vehicle';
import { Advantage } from '../domain/advantage';
import { AdvantageType } from '../domain/value-objects/advantage-type';
import { VehicleType } from '../domain/value-objects/vehicle-type';

function makeVehicleType(): VehicleType {
  return VehicleType.from({
    nom: 'Voiture', nom_interne: 'voiture', poids: 'Moyen',
    carrosserie: 6, manoeuvrabilite: 4, vitesse_max: 6, equipage: 2,
    emplacements: 4, prix: 12, description: '', regles: '', sponsors_autorises: [],
  });
}

function makeAdvantageType(): AdvantageType {
  return AdvantageType.from({
    nom: 'Tireur d\'Élite', nom_interne: 'tireur_elite', categorie: 'Militaire',
    prix: 2, description: '', regles: '',
  });
}

function makeRepo(team: Team): ITeamRepository {
  return {
    findByVehicleId: vi.fn().mockResolvedValue(team),
    save: vi.fn().mockResolvedValue(team),
  } as unknown as ITeamRepository;
}

/**
 * Régression : le use case faisait autrefois un lookup + BadRequestException
 * dupliqué en amont de l'agrégat pour le cas "avantage introuvable" - code mort une
 * fois qu'on constate que `Vehicle.removeAdvantage` lève déjà la même DomainException.
 * Cf. mémoire [[feedback_business_rules_in_domain_only]].
 */
describe('RemoveAdvantageUseCase', () => {
  it('rejette avec BadRequestException si l\'avantage est introuvable', async () => {
    const vehicle = new Vehicle(10, 1, makeVehicleType(), [], [], []);
    const team = new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, [vehicle]);
    const useCase = new RemoveAdvantageUseCase(makeRepo(team));

    await expect(useCase.execute({ vehicleId: 10, advantageId: 999, userId: 42 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('retire normalement un avantage acquis', async () => {
    const advantage = new Advantage(1, makeAdvantageType());
    const vehicle = new Vehicle(10, 1, makeVehicleType(), [], [], [advantage]);
    const team = new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, [vehicle]);
    const repo = makeRepo(team);
    const useCase = new RemoveAdvantageUseCase(repo);

    const result = await useCase.execute({ vehicleId: 10, advantageId: 1, userId: 42 });

    expect(result.advantages).toHaveLength(0);
    expect(repo.save).toHaveBeenCalledWith(team);
  });
});
