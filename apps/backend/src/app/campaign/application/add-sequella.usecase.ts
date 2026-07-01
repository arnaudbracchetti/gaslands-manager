import { BadRequestException } from '@nestjs/common';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { SequellaAddedEvent } from '../domain/events/sequella-added.event';
import { SEQUELLA_REGISTRY } from '../../team/sequella-decorators';
import type { CampaignParticipant } from '../domain/campaign-participant';
import { assertParticipant } from './record-ranking.usecase';
import { GameStatus } from '../domain/enums/game-status.enum';
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

    // L'atelier doit être OUVERT
    const game = campaign.findGame(cmd.gameId);
    if ((game as { type?: string }).type !== GameType.ATELIER || (game as { status?: string }).status !== GameStatus.OUVERT) {
      throw new BadRequestException('Cet atelier n\'est pas ouvert.');
    }

    // Résoudre le coût en Chocs
    const entry = SEQUELLA_REGISTRY.get(cmd.sequellaTypeNom);
    if (!entry) throw new BadRequestException(`Séquelle inconnue : "${cmd.sequellaTypeNom}".`);

    const vehicle = me.team.findVehicle(cmd.vehicleId);
    if (vehicle.chocs < entry.type.chocsCost) {
      throw new BadRequestException(
        `Chocs insuffisants : ${vehicle.chocs} disponibles, ${entry.type.chocsCost} requis pour "${entry.type.nom}".`,
      );
    }

    const event = new SequellaAddedEvent(
      0, cmd.gameId, me.id, 0,
      cmd.vehicleId, cmd.sequellaTypeNom, entry.type.chocsCost,
    );
    game.addEvent(event);                                     // valide canAccept
    event.execute([...campaign.participants] as CampaignParticipant[]);

    await this.campaignRepo.appendEvents(cmd.gameId, [event]);
  }
}
