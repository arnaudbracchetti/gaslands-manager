import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { RemoveWeaponUseCase } from './remove-weapon.usecase';
import type { ITeamRepository } from '../domain/team.repository.interface';
import { Team } from '../domain/team';
import { Vehicle } from '../domain/vehicle';
import { Weapon } from '../domain/weapon';
import { WeaponType } from '../domain/value-objects/weapon-type';
import { VehicleType } from '../domain/value-objects/vehicle-type';

function makeVehicleType(): VehicleType {
  return VehicleType.from({
    nom: 'Voiture', nom_interne: 'voiture', poids: 'Moyen',
    carrosserie: 6, manoeuvrabilite: 4, vitesse_max: 6, equipage: 2,
    emplacements: 4, prix: 12, description: '', regles: '', sponsors_autorises: [],
  });
}

function makeWeaponType(): WeaponType {
  return WeaponType.from({
    nom: 'Mitrailleuse', nom_interne: 'mitrailleuse', type: 'base',
    prix: 5, emplacement: 1, description: '', regles: '', sponsors_autorises: [],
    necessite_orientation: true,
  });
}

function makeRepo(team: Team): ITeamRepository {
  return {
    findByWeaponId: vi.fn().mockResolvedValue(team),
    save: vi.fn().mockResolvedValue(team),
  } as unknown as ITeamRepository;
}

/**
 * Référence de comparaison pour RemoveImprovementUseCase/RemoveAdvantageUseCase :
 * ce use case n'a jamais eu de contrôle `estDefaut` dupliqué - il laisse déjà
 * l'agrégat lever sa DomainException, uniformément traduite en BadRequestException.
 */
describe('RemoveWeaponUseCase', () => {
  it('rejette avec BadRequestException (400) pour une arme estDefaut', async () => {
    const canon = new Weapon(1, makeWeaponType(), 'tourelle', true);
    const vehicle = new Vehicle(10, 1, makeVehicleType(), [canon], []);
    const team = new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, [vehicle]);
    const useCase = new RemoveWeaponUseCase(makeRepo(team));

    await expect(useCase.execute({ weaponId: 1, userId: 42 })).rejects.toThrow(BadRequestException);
  });

  it('rejette avec BadRequestException si l\'arme est introuvable', async () => {
    const vehicle = new Vehicle(10, 1, makeVehicleType(), [], []);
    const team = new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, [vehicle]);
    const useCase = new RemoveWeaponUseCase(makeRepo(team));

    await expect(useCase.execute({ weaponId: 999, userId: 42 })).rejects.toThrow(BadRequestException);
  });

  it('retire normalement une arme achetée (estDefaut: false)', async () => {
    const mitrailleuse = new Weapon(1, makeWeaponType(), 'avant', false);
    const vehicle = new Vehicle(10, 1, makeVehicleType(), [mitrailleuse], []);
    const team = new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, [vehicle]);
    const useCase = new RemoveWeaponUseCase(makeRepo(team));

    const result = await useCase.execute({ weaponId: 1, userId: 42 });

    expect(result.weapons).toHaveLength(0);
  });
});
