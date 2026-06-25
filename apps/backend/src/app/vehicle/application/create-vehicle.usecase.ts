import { BadRequestException } from '@nestjs/common';
import type { IVehicleRepository } from '../domain/vehicle.repository.interface';
import type { ICatalogRepository } from '../domain/catalog.repository.interface';
import { Vehicle } from '../domain/vehicle';
import type { VehicleType } from '../domain/value-objects/vehicle-type';
import type { ImprovementType } from '../domain/value-objects/improvement-type';
import { Improvement } from '../domain/improvement';
import { LogUseCase } from '../log-use-case.decorator';

export interface CreateVehicleCommand {
  teamId: number;
  sponsorNom: string;
  nomInterne: string;
  userId: number;
}

/**
 * Crée un véhicule "nu" dans une équipe.
 *
 * Remplace VehicleService.create() :
 *  1. Vérifie que nomInterne est connu du catalogue.
 *  2. Vérifie que ce véhicule est autorisé par le sponsor.
 *  3. Insère les améliorations par défaut (estDefaut: true).
 *  4. Persiste via IVehicleRepository.
 *
 * La vérification d'appartenance de l'équipe (teamId → userId) reste dans
 * le repository au moment du save — ou doit être assurée en amont par le contrôleur.
 */
export class CreateVehicleUseCase {
  constructor(
    private readonly vehicleRepo: IVehicleRepository,
    private readonly catalogRepo: ICatalogRepository,
  ) {}

  @LogUseCase()
  async execute(cmd: CreateVehicleCommand): Promise<Vehicle> {
    const vehicleType = this.catalogRepo.getVehicleType(cmd.nomInterne);
    if (!vehicleType) {
      throw new BadRequestException(`Véhicule inconnu du catalogue : "${cmd.nomInterne}"`);
    }

    const authorizedTypes = this.catalogRepo.getVehicleTypesForSponsor(cmd.sponsorNom);
    const isAuthorized = authorizedTypes.some((t: VehicleType) => t.nomInterne === cmd.nomInterne);
    if (!isAuthorized) {
      throw new BadRequestException(
        `Le véhicule "${vehicleType.nom}" n'est pas autorisé pour le sponsor "${cmd.sponsorNom}"`,
      );
    }

    // Améliorations par défaut intégrées au profil de base (coût 0, non supprimables)
    const defaultImprovements: Improvement[] = vehicleType.defaultImprovements
      .map((nomInterne: string) => {
        const impType = this.catalogRepo.getImprovementType(nomInterne);
        if (!impType) return null;
        return new Improvement(0, impType, null, true);
      })
      .filter((imp): imp is Improvement => imp !== null);

    const vehicle = new Vehicle(0, cmd.teamId, cmd.sponsorNom, vehicleType, [], defaultImprovements);
    return this.vehicleRepo.save(vehicle);
  }
}
