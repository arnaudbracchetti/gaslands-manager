import { GameEvent } from './game-event';
import type { SeasonParticipant } from '../season-participant';
import type { VehicleType } from '../../../team/domain/value-objects/vehicle-type';
import type { WeaponType } from '../../../team/domain/value-objects/weapon-type';
import type { Orientation } from '../../../team/domain/team';

export type EquipmentOperation = 'BUY' | 'SELL';
export type EquipmentEntityType = 'VEHICLE' | 'WEAPON';

/**
 * Achat ou revente d'équipement en atelier campagne (D-S11).
 *
 * Les entités créées par BUY n'existent PAS en base — elles sont transientes,
 * recréées à chaque replay. Leur `id` est `-event.id` (espace négatif, distinct
 * des ids BDD positifs).
 *
 * Champs selon l'opération :
 * - BUY_VEHICLE   : targetVehicleId=null, targetEntityId=null  → crée Vehicle id=-this.id
 * - BUY_WEAPON    : targetVehicleId=vehicleId, targetEntityId=null → crée Weapon id=-this.id
 * - SELL_VEHICLE  : targetVehicleId=null, targetEntityId=vehicleId → retire le véhicule
 * - SELL_WEAPON   : targetVehicleId=vehicleId, targetEntityId=weaponId → retire l'arme
 *
 * `resolvedVehicleType` / `resolvedWeaponType` sont fournis par le use case (write-time)
 * ou par le mapper ORM (replay). Ils permettent à execute/undo de recréer les entités
 * transientes sans accès au catalogue.
 */
export class EquipmentChangedEvent extends GameEvent {
  constructor(
    id: number,
    gameId: number,
    participantId: number,
    eventOrder: number,
    readonly operation: EquipmentOperation,
    readonly entityType: EquipmentEntityType,
    readonly nomInterne: string,
    readonly cost: number,
    readonly targetVehicleId: number | null,
    readonly targetEntityId: number | null,
    readonly orientation: Orientation | null,
    private readonly resolvedVehicleType: VehicleType | null,
    private readonly resolvedWeaponType: WeaponType | null,
  ) {
    super(id, gameId, participantId, eventOrder);
  }

  execute(participants: SeasonParticipant[]): void {
    const p = this.findParticipant(participants);
    if (this.operation === 'BUY') {
      p.creditWallet(-this.cost);
      if (this.entityType === 'VEHICLE') {
        p.team.addCampaignVehicle(this.resolvedVehicleType!, -this.id);
      } else {
        p.team.addCampaignWeapon(this.targetVehicleId!, this.resolvedWeaponType!, this.orientation, -this.id);
      }
    } else {
      p.creditWallet(this.cost);
      if (this.entityType === 'VEHICLE') {
        p.team.removeCampaignVehicle(this.targetEntityId!);
      } else {
        p.team.removeCampaignWeapon(this.targetVehicleId!, this.targetEntityId!);
      }
    }
  }

  undo(participants: SeasonParticipant[]): void {
    const p = this.findParticipant(participants);
    if (this.operation === 'BUY') {
      p.creditWallet(this.cost);
      if (this.entityType === 'VEHICLE') {
        p.team.removeCampaignVehicle(-this.id);
      } else {
        p.team.removeCampaignWeapon(this.targetVehicleId!, -this.id);
      }
    } else {
      p.creditWallet(-this.cost);
      if (this.entityType === 'VEHICLE') {
        p.team.addCampaignVehicle(this.resolvedVehicleType!, this.targetEntityId!);
      } else {
        p.team.addCampaignWeapon(this.targetVehicleId!, this.resolvedWeaponType!, this.orientation, this.targetEntityId!);
      }
    }
  }
}
