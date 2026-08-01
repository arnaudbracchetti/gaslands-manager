import { NotFoundException } from '@nestjs/common';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { CatalogService } from '../../catalog/catalog.service';
import { assertParticipant } from './authorization.helpers';
import type { VehicleType } from '../../team/domain/value-objects/vehicle-type';
import type { AvailableVehicleDto } from '../../team/dto/available-vehicle.dto';

export interface GetWorkshopAvailableVehiclesCommand {
  campaignId: number;
  userId: number;
}

/**
 * Verdict de disponibilité budgétaire des véhicules du sponsor pour l'achat d'un
 * nouveau véhicule en atelier.
 *
 * Mirroir de `GetWorkshopAvailableWeaponsUseCase`, mais sans `vehicleId` : aucun
 * véhicule n'existe encore avant cet achat, donc pas de `Vehicle.canAddXxx` à
 * appeler — `Team.canAddVehicle` porte directement la règle. Le budget est la
 * cagnotte du participant (`me.wallet`), pas `team.remainingBudget`.
 */
export class GetWorkshopAvailableVehiclesUseCase {
  constructor(
    private readonly replayService: CampaignReplayService,
    private readonly catalog: CatalogService,
  ) {}

  async execute(cmd: GetWorkshopAvailableVehiclesCommand): Promise<AvailableVehicleDto[]> {
    const campaign = await this.replayService.loadAndReplay(cmd.campaignId);
    const me = assertParticipant(campaign, cmd.userId);
    if (!me.hasTeam) {
      throw new NotFoundException('Campagne introuvable ou accès non autorisé.');
    }

    const vehicleTypes = this.catalog.getVehicleTypesForSponsor(me.team.sponsor);
    const budget = me.wallet;

    return vehicleTypes.map((vt: VehicleType): AvailableVehicleDto => {
      const result = me.team.canAddVehicle(vt, budget);
      return {
        nomInterne: vt.nomInterne,
        disponible: result.ok,
        raison: result.ok ? undefined : result.reason,
      };
    });
  }
}
