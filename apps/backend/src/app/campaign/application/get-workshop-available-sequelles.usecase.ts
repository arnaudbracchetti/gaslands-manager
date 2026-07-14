import { NotFoundException } from '@nestjs/common';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { CatalogService } from '../../catalog/catalog.service';
import { assertParticipant } from './authorization.helpers';
import { DomainException } from '../../shared/domain/domain-exception';
import type { CampaignParticipant } from '../domain/campaign-participant';
import type { Vehicle } from '../../team/domain/vehicle';
import type { SequellaType } from '../../team/domain/value-objects/sequella-type';
import type { AvailableSequellaDto } from '../../team/dto/available-sequella.dto';

export interface GetWorkshopAvailableSequellesCommand {
  campaignId: number;
  vehicleId: number;
  userId: number;
}

/**
 * Verdict de disponibilité des séquelles achetables (origine `ATELIER`) pour un
 * véhicule d'atelier.
 *
 * Miroir campagne de `GetWorkshopAvailableAdvantagesUseCase`, avec deux différences
 * dictées par la nature des séquelles (cf. `Sequelle`, catalog.interfaces.ts) :
 *  - la source n'est PAS scopée par sponsor (`catalog.getAllSequellaTypes()`, pas de
 *    `...ForSponsor` — une séquelle s'applique quel que soit le sponsor de l'équipe) ;
 *  - le verdict (`Vehicle.canAddSequella`) ne prend aucun paramètre budget : la monnaie
 *    est `vehicle.chocs`, pas la cagnotte du participant.
 *
 * Les séquelles `TABLE_EPAVES` sont filtrées en amont : elles ne peuvent jamais être
 * achetées directement en atelier (imposées uniquement par un tirage de la Table des
 * Épaves), donc ne figurent pas dans ce verdict d'achat.
 */
export class GetWorkshopAvailableSequellesUseCase {
  constructor(
    private readonly replayService: CampaignReplayService,
    private readonly catalog: CatalogService,
  ) {}

  async execute(cmd: GetWorkshopAvailableSequellesCommand): Promise<AvailableSequellaDto[]> {
    const campaign = await this.replayService.loadAndReplay(cmd.campaignId);
    const me = assertParticipant(campaign, cmd.userId);
    if (!me.hasTeam) {
      throw new NotFoundException('Campagne introuvable ou accès non autorisé.');
    }

    const vehicle = this.resolveVehicle(me, cmd.vehicleId);
    const sequellaTypes = this.catalog.getAllSequellaTypes().filter((st) => st.origine === 'ATELIER');

    return sequellaTypes.map((st: SequellaType): AvailableSequellaDto => {
      const verdict = vehicle.canAddSequella(st);
      return {
        nom: st.nom,
        nomInterne: st.nomInterne,
        chocsCost: st.chocsCost,
        description: st.description,
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
