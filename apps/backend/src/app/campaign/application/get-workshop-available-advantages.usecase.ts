import { NotFoundException } from '@nestjs/common';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { CatalogService } from '../../catalog/catalog.service';
import { assertParticipant } from './authorization.helpers';
import { DomainException } from '../../shared/domain/domain-exception';
import type { CampaignParticipant } from '../domain/campaign-participant';
import type { Vehicle } from '../../team/domain/vehicle';
import type { AdvantageType } from '../../team/domain/value-objects/advantage-type';
import type { AvailableAdvantageDto } from '../../team/dto/available-advantage.dto';

export interface GetWorkshopAvailableAdvantagesCommand {
  campaignId: number;
  vehicleId: number;
  userId: number;
}

/**
 * Verdict de disponibilité des avantages du sponsor pour un véhicule d'atelier.
 *
 * Miroir campagne de `GetAvailableAdvantagesUseCase` (module team) : réutilise
 * `Vehicle.canAddAdvantage` verbatim (le verdict, y compris Cascadeur/Sur Deux Roues,
 * est une règle de domaine — pas dupliquée ici), budget = cagnotte (`me.wallet`).
 *
 * Comme pour armes/améliorations : ce verdict est indicatif côté IHM — l'écriture
 * (`Game.changeEquipment`) ne revérifie que le budget, pas les 2 restrictions
 * Cascadeur/Sur Deux Roues (même périmètre "Temps 2" déjà en place pour le reste de
 * l'équipement en atelier).
 */
export class GetWorkshopAvailableAdvantagesUseCase {
  constructor(
    private readonly replayService: CampaignReplayService,
    private readonly catalog: CatalogService,
  ) {}

  async execute(cmd: GetWorkshopAvailableAdvantagesCommand): Promise<AvailableAdvantageDto[]> {
    const campaign = await this.replayService.loadAndReplay(cmd.campaignId);
    const me = assertParticipant(campaign, cmd.userId);
    if (!me.hasTeam) {
      throw new NotFoundException('Campagne introuvable ou accès non autorisé.');
    }

    const vehicle = this.resolveVehicle(me, cmd.vehicleId);
    const budget = me.wallet;
    const advantageTypes = this.catalog.getAdvantageTypesForSponsor(me.team.sponsor);

    return advantageTypes.map((at: AdvantageType): AvailableAdvantageDto => {
      const verdict = vehicle.canAddAdvantage(at, budget);
      return {
        nom: at.nom,
        nomInterne: at.nomInterne,
        categorie: at.categorie,
        prix: at.price,
        description: at.description,
        regles: at.regles,
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
