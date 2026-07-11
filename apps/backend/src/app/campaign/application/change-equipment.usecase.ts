import { BadRequestException } from '@nestjs/common';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { DomainException } from '../../shared/domain/domain-exception';
import { EquipmentOperation, EquipmentEntityType } from '../domain/enums/equipment-change.enums';
import type { WeaponOrientation } from '../../team/domain/team';
import type { CatalogService } from '../../catalog/catalog.service';
import { assertParticipant } from './authorization.helpers';

export interface ChangeEquipmentCommand {
  campaignId: number;
  userId: number;
  operation: EquipmentOperation;
  entityType: EquipmentEntityType;
  /** Nom interne du catalogue — requis pour BUY, optionnel pour SELL. */
  nomInterne: string;
  /** Véhicule hôte — requis pour BUY_WEAPON, SELL_WEAPON ; id de la cible pour SELL_VEHICLE. */
  targetVehicleId?: number | null;
  /** Id de l'entité à vendre — requis pour SELL. */
  targetEntityId?: number | null;
  /** WEAPON : 5 valeurs possibles (dont `'tourelle'` — arc à 360°, coût ×3). */
  orientation?: WeaponOrientation | null;
}

/**
 * D1-D3 — Achat ou revente d'équipement en atelier campagne.
 *
 * La validation métier (coût, existence de la cible, cagnotte) vit dans
 * `Game.changeEquipment()` — `Campaign.findAtelierGame()` se contente de localiser
 * l'unique partie en ATELIER. Ce use case se limite à résoudre les Value Objects
 * catalogue depuis `nomInterne` (étape légitime côté use case, cf. pattern
 * documenté pour le module `team/` — ARCHITECTURE.md §3.4) et à persister.
 *
 * `Game.changeEquipment()` NE DOIT PAS appeler `event.execute()` avant la
 * persistance. La raison : pour les achats
 * (BUY), l'id de l'entité transiente est calculé comme `-event.id` (D-S11). Or l'id
 * de l'événement n'est assigné qu'après persist. En persistant d'abord, puis en
 * rechargeant via `loadAndReplay`, le replay applique l'événement avec son vrai id
 * DB → l'entité transiente reçoit `-event.id` correct.
 */
export class ChangeEquipmentUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
    private readonly catalog: CatalogService,
  ) {}

  async execute(cmd: ChangeEquipmentCommand): Promise<void> {
    const campaign = await this.replayService.loadAndReplay(cmd.campaignId);
    const me = assertParticipant(campaign, cmd.userId);

    const resolvedVehicleType = cmd.entityType === EquipmentEntityType.VEHICLE
      ? (this.catalog.getVehicleType(cmd.nomInterne) ?? null)
      : null;

    const resolvedWeaponType = cmd.entityType === EquipmentEntityType.WEAPON
      ? (this.catalog.getWeaponType(cmd.nomInterne) ?? null)
      : null;

    const resolvedImprovementType = cmd.entityType === EquipmentEntityType.IMPROVEMENT
      ? (this.catalog.getImprovementType(cmd.nomInterne) ?? null)
      : null;

    try {
      const game = campaign.findAtelierGame();
      const result = game.changeEquipment(me, {
        operation: cmd.operation,
        entityType: cmd.entityType,
        nomInterne: cmd.nomInterne,
        targetVehicleId: cmd.targetVehicleId,
        targetEntityId: cmd.targetEntityId,
        orientation: cmd.orientation,
        resolvedVehicleType,
        resolvedWeaponType,
        resolvedImprovementType,
      });
      // Annulation d'achat de cette session : suppression pure de l'événement BUY, aucun
      // événement à ajouter (cf. Game.changeEquipment). `game.id` (pas `events[0].gameId`)
      // car `result.events` est vide dans ce cas.
      if (result.deleteEventId !== null) {
        await this.campaignRepo.deleteEvent(result.deleteEventId);
      } else {
        await this.campaignRepo.appendEvents(game.id, result.events);
      }
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }
  }
}
