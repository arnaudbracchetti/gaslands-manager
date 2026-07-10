import { BadRequestException } from '@nestjs/common';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { DomainException } from '../../shared/domain/domain-exception';
import { SequellaAddedEvent } from '../domain/events/sequella-added.event';
import { SEQUELLA_REGISTRY } from '../../team/domain/sequella-decorators';
import { assertParticipant } from './authorization.helpers';
import { GameStatus } from '../domain/enums/game-status.enum';

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

    // Le statut ATELIER et la suffisance des Chocs sont désormais des gardes de
    // DOMAINE (Game.addEvent + SequellaAddedEvent.execute → vehicle.addChocs).
    const game = campaign.games.find((g) => g.status === GameStatus.ATELIER);
    if (!game) {
      throw new BadRequestException('Aucun atelier ouvert actuellement.');
    }

    const entry = SEQUELLA_REGISTRY.get(cmd.sequellaTypeNom);
    if (!entry) throw new BadRequestException(`Séquelle inconnue : "${cmd.sequellaTypeNom}".`);

    const event = new SequellaAddedEvent(
      0, game.id, me.id, 0,
      cmd.vehicleId, cmd.sequellaTypeNom, entry.type.chocsCost,
    );
    try {
      campaign.applyNewEvent(game.id, event);                  // valide canAccept + statut ATELIER
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    await this.campaignRepo.appendEvents(game.id, [event]);
  }
}
