import { NotFoundException } from '@nestjs/common';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { CatalogService } from '../../catalog/catalog.service';
import { assertParticipant } from './authorization.helpers';
import { DomainException } from '../../shared/domain/domain-exception';
import type { CampaignParticipant } from '../domain/campaign-participant';
import type { Vehicle } from '../../team/domain/vehicle';
import type { ImprovementType } from '../../team/domain/value-objects/improvement-type';
import type { AvailableImprovementDto } from '../../team/dto/available-improvement.dto';

export interface GetWorkshopAvailableImprovementsCommand {
  campaignId: number;
  vehicleId: number;
  userId: number;
}

/**
 * Verdict de disponibilité des améliorations du sponsor pour un véhicule d'atelier (R1).
 *
 * Miroir campagne de `GetAvailableImprovementsUseCase` : réutilise
 * `Vehicle.canAddImprovementInAnyOrientation` verbatim (le verdict, y compris la
 * tolérance à l'orientation, est une règle de domaine — pas dupliquée ici), budget =
 * cagnotte (`me.wallet`).
 *
 * Temps 1 : la **Tourelle est exclue** (prix variable ×3 + assignation d'arme sans
 * événement campagne dédié — cf. doc de design). Elle reviendra au Temps 2.
 */
export class GetWorkshopAvailableImprovementsUseCase {
  constructor(
    private readonly replayService: CampaignReplayService,
    private readonly catalog: CatalogService,
  ) {}

  async execute(cmd: GetWorkshopAvailableImprovementsCommand): Promise<AvailableImprovementDto[]> {
    const campaign = await this.replayService.loadAndReplay(cmd.campaignId);
    const me = assertParticipant(campaign, cmd.userId);
    if (!me.hasTeam) {
      throw new NotFoundException('Campagne introuvable ou accès non autorisé.');
    }

    const vehicle = this.resolveVehicle(me, cmd.vehicleId);
    const budget = me.wallet;
    const improvementTypes = this.catalog
      .getImprovementTypesForSponsor(me.team.sponsor)
      .filter((it: ImprovementType) => !it.isTourelle);

    return improvementTypes.map((it: ImprovementType): AvailableImprovementDto => {
      const verdict = vehicle.canAddImprovementInAnyOrientation(it, budget);
      return {
        nom: it.nom,
        nomInterne: it.nomInterne,
        prix: it.hasVariablePrice ? 'x3' : it.price,
        emplacement: it.slots,
        description: it.description,
        regles: it.regles,
        disponible: verdict.ok,
        raison: verdict.ok ? undefined : verdict.reason,
      };
    });
  }

  /** Le véhicule doit appartenir à l'équipe du participant — sinon 404 (pas de fuite). */
  private resolveVehicle(me: CampaignParticipant, vehicleId: number): Vehicle {
    try {
      return me.team.findVehicle(vehicleId);
    } catch (e) {
      if (e instanceof DomainException) {
        throw new NotFoundException('Véhicule introuvable ou accès non autorisé.');
      }
      throw e;
    }
  }
}
