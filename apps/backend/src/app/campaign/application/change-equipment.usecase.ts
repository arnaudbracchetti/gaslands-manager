import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { DomainException } from '../../shared/domain/domain-exception';
import { EquipmentChangedEvent } from '../domain/events/equipment-changed.event';
import type { EquipmentOperation, EquipmentEntityType } from '../domain/events/equipment-changed.event';
import { GameStatus } from '../domain/enums/game-status.enum';
import type { Orientation } from '../../team/domain/team';
import type { CatalogService } from '../../catalog/catalog.service';
import { assertParticipant } from './record-ranking.usecase';

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
  orientation?: Orientation | null;
}

/**
 * D1-D3 — Achat ou revente d'équipement en atelier campagne.
 *
 * Contrairement aux use cases des Parties 4, ce use case NE DOIT PAS appeler
 * `event.execute()` avant la persistance. La raison : pour les achats (BUY), l'id
 * de l'entité transiente est calculé comme `-event.id` (D-S11). Or l'id de l'événement
 * n'est assigné qu'après persist. En persistant d'abord, puis en rechargeant via
 * `loadAndReplay`, le replay applique l'événement avec son vrai id DB → l'entité
 * transiente reçoit `-event.id` correct.
 *
 * Le use case effectue donc :
 * 1. Validation manuelle (wallet, entité existante, catalog)
 * 2. Persist `appendEvents` (NO execute)
 * 3. Retourne 204 — le client rafraîchit via `GET /workshop`
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

    // Un seul atelier actif à la fois par campagne (Campaign.enterAtelier) — pas besoin
    // que l'appelant précise sur quelle partie l'événement doit être journalisé.
    const game = campaign.games.find((g) => g.status === GameStatus.ATELIER);
    if (!game) {
      throw new BadRequestException('Aucun atelier ouvert actuellement.');
    }

    const resolvedVehicleType = cmd.entityType === 'VEHICLE'
      ? (this.catalog.getVehicleType(cmd.nomInterne) ?? null)
      : null;

    const resolvedWeaponType = cmd.entityType === 'WEAPON'
      ? (this.catalog.getWeaponType(cmd.nomInterne) ?? null)
      : null;

    if (cmd.operation === 'BUY') {
      if (cmd.entityType === 'VEHICLE' && !resolvedVehicleType) {
        throw new BadRequestException(`Véhicule inconnu du catalogue : "${cmd.nomInterne}".`);
      }
      if (cmd.entityType === 'WEAPON' && !resolvedWeaponType) {
        throw new BadRequestException(`Arme inconnue du catalogue : "${cmd.nomInterne}".`);
      }
    } else {
      // SELL — vérifier que l'entité existe dans le team transient
      if (cmd.entityType === 'VEHICLE') {
        me.team.findVehicle(cmd.targetEntityId!); // lève NotFoundException si absent
      } else {
        // weapon : chercher dans le véhicule hôte
        const vehicle = me.team.findVehicle(cmd.targetVehicleId!);
        const weapon = vehicle.weapons.find(w => w.id === cmd.targetEntityId);
        if (!weapon) throw new NotFoundException(`Arme ${cmd.targetEntityId} introuvable.`);
      }
    }

    const cost = cmd.operation === 'BUY'
      ? (cmd.entityType === 'VEHICLE' ? resolvedVehicleType!.price : resolvedWeaponType!.price)
      : (cmd.entityType === 'VEHICLE'
        ? me.team.findVehicle(cmd.targetEntityId!).type.price
        : (() => {
            const v = me.team.findVehicle(cmd.targetVehicleId!);
            return v.weapons.find(w => w.id === cmd.targetEntityId)!.type.price;
          })());

    const event = new EquipmentChangedEvent(
      0,
      game.id,
      me.id,
      0,
      cmd.operation,
      cmd.entityType,
      cmd.nomInterne,
      cost,
      cmd.targetVehicleId ?? null,
      cmd.targetEntityId ?? null,
      cmd.orientation ?? null,
      resolvedVehicleType,
      resolvedWeaponType,
    );

    try {
      // Affordability (BUY) et type d'événement sont désormais des gardes de domaine
      // (assertCanAfford, Game.addEvent). Ne PAS exécuter l'événement ici (D-S11 :
      // id=0 donnerait un id transient invalide) — le client rafraîchit via /workshop.
      if (cmd.operation === 'BUY') me.assertCanAfford(cost);
      game.addEvent(event);
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    await this.campaignRepo.appendEvents(game.id, [event]);
  }
}
