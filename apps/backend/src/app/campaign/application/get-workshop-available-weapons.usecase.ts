import { NotFoundException } from '@nestjs/common';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { CatalogService } from '../../catalog/catalog.service';
import { assertParticipant } from './authorization.helpers';
import { DomainException } from '../../shared/domain/domain-exception';
import type { CampaignParticipant } from '../domain/campaign-participant';
import type { Vehicle } from '../../team/domain/vehicle';
import type { WeaponType } from '../../team/domain/value-objects/weapon-type';
import type { AvailableWeaponDto } from '../../team/dto/available-weapon.dto';

export interface GetWorkshopAvailableWeaponsCommand {
  campaignId: number;
  vehicleId: number;
  userId: number;
}

/**
 * Verdict de disponibilité des armes du sponsor pour un véhicule d'atelier (R1).
 *
 * Miroir campagne de `GetAvailableWeaponsUseCase` (module team) : réutilise
 * `Vehicle.canAddWeapon` verbatim. Deux seules différences avec la version équipe :
 * le véhicule provient du replay campagne (`me.team.findVehicle`) et le budget est la
 * cagnotte du participant (`me.wallet`), pas `team.remainingBudget`.
 *
 * Temps 1 : aucun enforcement au write encore — ce verdict est purement indicatif côté
 * IHM (cf. doc de design, D2/R3b différés).
 */
export class GetWorkshopAvailableWeaponsUseCase {
  constructor(
    private readonly replayService: CampaignReplayService,
    private readonly catalog: CatalogService,
  ) {}

  async execute(cmd: GetWorkshopAvailableWeaponsCommand): Promise<AvailableWeaponDto[]> {
    const campaign = await this.replayService.loadAndReplay(cmd.campaignId);
    const me = assertParticipant(campaign, cmd.userId);
    if (!me.hasTeam) {
      throw new NotFoundException('Campagne introuvable ou accès non autorisé.');
    }

    const vehicle = this.resolveVehicle(me, cmd.vehicleId);
    const budget = me.wallet;
    const weaponTypes = this.catalog.getWeaponTypesForSponsor(me.team.sponsor);

    return weaponTypes.map((wt: WeaponType): AvailableWeaponDto => {
      const result = vehicle.canAddWeapon(wt, null, budget);
      return {
        nom: wt.nom,
        nomInterne: wt.nomInterne,
        prix: wt.price,
        emplacement: wt.slots,
        type: wt.type,
        description: wt.description,
        regles: wt.regles,
        disponible: result.ok,
        raison: result.ok ? undefined : result.reason,
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
