import { GameEvent } from './game-event';
import type { CampaignParticipant } from '../campaign-participant';
import type { VehicleType } from '../../../team/domain/value-objects/vehicle-type';
import type { WeaponType } from '../../../team/domain/value-objects/weapon-type';
import type { ImprovementType } from '../../../team/domain/value-objects/improvement-type';
import type { Orientation } from '../../../team/domain/team';
import { EquipmentOperation, EquipmentEntityType } from '../enums/equipment-change.enums';

export { EquipmentOperation, EquipmentEntityType };

/**
 * Achat ou revente d'équipement en atelier campagne (D-S11).
 *
 * Les entités créées par BUY n'existent PAS en base — elles sont transientes,
 * recréées à chaque replay. Leur `id` est `-event.id` (espace négatif, distinct
 * des ids BDD positifs).
 *
 * Champs selon l'opération :
 * - BUY_VEHICLE     : targetVehicleId=null, targetEntityId=null  → crée Vehicle id=-this.id
 * - BUY_WEAPON      : targetVehicleId=vehicleId, targetEntityId=null → crée Weapon id=-this.id
 * - BUY_IMPROVEMENT : targetVehicleId=vehicleId, targetEntityId=null → crée Improvement id=-this.id
 * - SELL_VEHICLE    : targetVehicleId=null, targetEntityId=vehicleId → retire le véhicule
 * - SELL_WEAPON     : targetVehicleId=vehicleId, targetEntityId=weaponId → retire l'arme
 * - SELL_IMPROVEMENT: targetVehicleId=vehicleId, targetEntityId=improvementId → retire l'amélioration
 *
 * `resolvedVehicleType` / `resolvedWeaponType` / `resolvedImprovementType` sont fournis par
 * le use case (write-time) ou par le mapper ORM (replay). Ils permettent à execute/undo de
 * recréer les entités transientes sans accès au catalogue.
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
    private readonly resolvedImprovementType: ImprovementType | null = null,
  ) {
    super(id, gameId, participantId, eventOrder);
  }

  execute(participants: CampaignParticipant[]): void {
    const p = this.findParticipant(participants);
    if (this.operation === EquipmentOperation.BUY) {
      p.creditWallet(-this.cost);
      this.addEntity(p, -this.id);
    } else {
      p.creditWallet(this.cost);
      this.removeEntity(p, this.targetEntityId!);
    }
  }

  undo(participants: CampaignParticipant[]): void {
    const p = this.findParticipant(participants);
    if (this.operation === EquipmentOperation.BUY) {
      p.creditWallet(this.cost);
      this.removeEntity(p, -this.id);
    } else {
      p.creditWallet(-this.cost);
      this.addEntity(p, this.targetEntityId!);
    }
  }

  /** Recrée l'entité transiente avec l'id fourni (achat, ou annulation d'une revente). */
  private addEntity(p: CampaignParticipant, entityId: number): void {
    switch (this.entityType) {
      case EquipmentEntityType.VEHICLE:
        p.team.addCampaignVehicle(this.resolvedVehicleType!, entityId);
        break;
      case EquipmentEntityType.WEAPON:
        p.team.addCampaignWeapon(this.targetVehicleId!, this.resolvedWeaponType!, this.orientation, entityId);
        break;
      case EquipmentEntityType.IMPROVEMENT:
        p.team.addCampaignImprovement(this.targetVehicleId!, this.resolvedImprovementType!, this.orientation, entityId);
        break;
    }
  }

  /** Retire l'entité ciblée (revente, ou annulation d'un achat). */
  private removeEntity(p: CampaignParticipant, entityId: number): void {
    switch (this.entityType) {
      case EquipmentEntityType.VEHICLE:
        p.team.removeCampaignVehicle(entityId);
        break;
      case EquipmentEntityType.WEAPON:
        p.team.removeCampaignWeapon(this.targetVehicleId!, entityId);
        break;
      case EquipmentEntityType.IMPROVEMENT:
        p.team.removeCampaignImprovement(this.targetVehicleId!, entityId);
        break;
    }
  }

  describe(): string {
    const verb = this.operation === EquipmentOperation.BUY ? 'Achat' : 'Vente';
    return `${verb} : ${this.nomInterne} (${this.cost} jerricans)`;
  }
}
