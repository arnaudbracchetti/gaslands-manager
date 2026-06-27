import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { ITeamRepository } from '../domain/team.repository.interface';
import type { Team } from '../domain/team';
import { DomainException } from '../domain/team';
import { LogUseCase } from '../log-use-case.decorator';

export interface RemoveImprovementCommand {
  vehicleId: number;
  improvementId: number;
  userId: number;
}

/**
 * Retire une amélioration achetée d'un véhicule.
 * Traduit DomainException en ForbiddenException pour les améliorations par défaut,
 * et en BadRequestException pour les autres erreurs métier.
 */
export class RemoveImprovementUseCase {
  constructor(private readonly teamRepo: ITeamRepository) {}

  @LogUseCase()
  async execute(cmd: RemoveImprovementCommand): Promise<Team> {
    const team = await this.teamRepo.findByVehicleId(cmd.vehicleId, cmd.userId);
    const vehicle = team.findVehicle(cmd.vehicleId);

    // Vérifier si c'est une amélioration par défaut avant de déléguer à l'agrégat,
    // pour distinguer ForbiddenException (interdit) de BadRequestException (introuvable).
    const imp = vehicle.improvements.find((i) => i.id === cmd.improvementId);
    if (!imp) {
      throw new BadRequestException(
        `Amélioration #${cmd.improvementId} introuvable sur le véhicule #${cmd.vehicleId}`,
      );
    }
    if (imp.estDefaut) {
      throw new ForbiddenException(
        `"${imp.type.nomInterne}" fait partie du profil de base de ce véhicule et ne peut pas être retirée.`,
      );
    }

    try {
      team.removeImprovementFromVehicle(cmd.vehicleId, cmd.improvementId);
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    return this.teamRepo.save(team);
  }
}
