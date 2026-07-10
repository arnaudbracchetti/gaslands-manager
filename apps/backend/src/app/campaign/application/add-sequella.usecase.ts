import { BadRequestException } from '@nestjs/common';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { DomainException } from '../../shared/domain/domain-exception';
import { SEQUELLA_REGISTRY } from '../../team/domain/sequella-decorators';
import { assertParticipant } from './authorization.helpers';

export interface AddSequellaCommand {
  campaignId: number;
  userId: number;
  vehicleId: number;
  sequellaTypeNom: string;
}

/**
 * D4/E4 — Échange des Chocs contre une séquelle permanente en atelier.
 *
 * Accessible à tout participant (pas uniquement l'organisateur) — chaque joueur
 * répare son propre véhicule. Un seul atelier actif à la fois par campagne
 * (Campaign.enterAtelier) — pas besoin que l'appelant précise sur quelle partie
 * l'événement doit être journalisé.
 *
 * `SequellaAddedEvent.execute()` valide les Chocs disponibles via `vehicle.addChocs(-n)`.
 * Si insuffisants, `DomainException` est levée → convertie en `BadRequestException`.
 */
export class AddSequellaUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
  ) {}

  async execute(cmd: AddSequellaCommand): Promise<void> {
    const campaign = await this.replayService.loadAndReplay(cmd.campaignId);
    const me = assertParticipant(campaign, cmd.userId);

    const entry = SEQUELLA_REGISTRY.get(cmd.sequellaTypeNom);
    if (!entry) throw new BadRequestException(`Séquelle inconnue : "${cmd.sequellaTypeNom}".`);

    try {
      const game = campaign.findAtelierGame();  // lève DomainException si aucun atelier ouvert
      const events = game.addSequella(me, cmd.vehicleId, cmd.sequellaTypeNom, entry.type.chocsCost);
      await this.campaignRepo.appendEvents(game.id, events);
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }
  }
}
