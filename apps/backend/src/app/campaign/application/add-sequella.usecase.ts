import { BadRequestException } from '@nestjs/common';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { DomainException } from '../../shared/domain/domain-exception';
import { SequellaAddedEvent } from '../domain/events/sequella-added.event';
import { SEQUELLA_REGISTRY } from '../../team/domain/sequella-decorators';
import { assertParticipant } from './record-ranking.usecase';
import { GameType } from '../game.enums';

export interface AddSequellaCommand {
  campaignId: number;
  gameId: number;
  userId: number;
  vehicleId: number;
  sequellaTypeNom: string;
}

/**
 * D4/E4 — Échange des Chocs contre une séquelle permanente en atelier ou post-épave.
 *
 * Accessible à tout participant (pas uniquement l'organisateur) — chaque joueur
 * répare son propre véhicule. L'atelier doit être OUVERT.
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

    // Les séquelles se gèrent en atelier. Le statut OUVERT et la suffisance des Chocs sont
    // désormais des gardes de DOMAINE (Game.addEvent + SequellaAddedEvent.execute →
    // vehicle.addChocs) : on ne les redouble plus ici.
    const game = campaign.findGame(cmd.gameId);
    if (game.type !== GameType.ATELIER) {
      throw new BadRequestException('Les séquelles se gèrent en atelier.');
    }

    const entry = SEQUELLA_REGISTRY.get(cmd.sequellaTypeNom);
    if (!entry) throw new BadRequestException(`Séquelle inconnue : "${cmd.sequellaTypeNom}".`);

    const event = new SequellaAddedEvent(
      0, cmd.gameId, me.id, 0,
      cmd.vehicleId, cmd.sequellaTypeNom, entry.type.chocsCost,
    );
    try {
      campaign.applyNewEvent(cmd.gameId, event);                // valide canAccept + statut OUVERT
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    await this.campaignRepo.appendEvents(cmd.gameId, [event]);
  }
}
