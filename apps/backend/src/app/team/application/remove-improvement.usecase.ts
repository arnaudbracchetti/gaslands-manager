import { BadRequestException } from '@nestjs/common';
import type { ITeamRepository } from '../domain/team.repository.interface';
import type { Vehicle } from '../domain/vehicle';
import { DomainException } from '../domain/team';
import { LogUseCase } from '../log-use-case.decorator';

export interface RemoveImprovementCommand {
  vehicleId: number;
  improvementId: number;
  userId: number;
}

/**
 * Retire une amélioration achetée d'un véhicule.
 * Toute règle de refus (amélioration introuvable, intégrée au profil de base...)
 * est portée par l'agrégat (Vehicle.removeImprovement) - même chemin que
 * RemoveWeaponUseCase : la DomainException est uniformément traduite en
 * BadRequestException, sans contrôle métier dupliqué dans le use case.
 */
export class RemoveImprovementUseCase {
  constructor(private readonly teamRepo: ITeamRepository) {}

  @LogUseCase()
  async execute(cmd: RemoveImprovementCommand): Promise<Vehicle> {
    const team = await this.teamRepo.findByVehicleId(cmd.vehicleId, cmd.userId);

    try {
      team.removeImprovementFromVehicle(cmd.vehicleId, cmd.improvementId);
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    const saved = await this.teamRepo.save(team);
    return saved.findVehicle(cmd.vehicleId);
  }
}
