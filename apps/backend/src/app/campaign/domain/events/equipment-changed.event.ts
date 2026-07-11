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
 * - SELL_WEAPON     : targetVehicleId=vehicleId, targetEntityId=weaponId → flague l'arme "vendue" (isSold)
 * - SELL_IMPROVEMENT: targetVehicleId=vehicleId, targetEntityId=improvementId → flague l'amélioration "vendue" (isSold)
 *
 * SELL_WEAPON/SELL_IMPROVEMENT ne retirent plus l'entité : elle reste visible (barrée,
 * badge "Vendue" côté IHM), remboursée à moitié prix (cf. `Weapon.price`/`Improvement.price`,
 * prix résiduel). SELL_VEHICLE reste sur l'ancien modèle (suppression complète, remboursement
 * plein) — hors scope de l'annulation vs revente (Vehicle ne porte pas `isSold`).
 *
 * `resolvedVehicleType` / `resolvedWeaponType` / `resolvedImprovementType` sont fournis par
 * le use case (write-time) ou par le mapper ORM (replay). Ils permettent à execute/undo de
 * recréer les entités transientes sans accès au catalogue.
 *
 * `p.team.addCampaignWeapon(vehicleId, ...)`/`markWeaponSold(vehicleId, ...)` (et leurs
 * équivalents amélioration) sont des passe-plats sur `Team` qui délèguent aussitôt à
 * `Vehicle` (`this.findVehicle(vehicleId).xxx(...)`) — la logique réelle vit déjà sur
 * `Vehicle`. Cet événement appelle volontairement `Team`, jamais `Vehicle` directement :
 * `Team` est l'agrégat racine (cf. `docs/ARCHITECTURE.md` §3.4), et les appelants externes
 * à l'agrégat ne doivent transiter que par sa racine, jamais par une entité enfant en la
 * contournant — même pattern préexistant qu'`addCampaignWeapon`/`removeCampaignWeapon`.
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

  /**
   * Le wallet n'est plus jamais touché ici : il est dérivé de `Team.remainingBudget`
   * (cf. `CampaignParticipant.wallet`) — un achat/une vente modifie l'arbre d'entités
   * (via createTransientEquipment/removeTransientEquipment/markSoldEntity/clearSoldEntity),
   * ce qui suffit à faire varier le budget restant, donc le wallet dérivé, du bon montant
   * automatiquement.
   *
   * VEHICULE reste sur l'ancien modèle (suppression complète à la revente, jamais flaguée
   * "vendue") — `isSold` n'existe que sur Weapon/Improvement (cf. annulation vs revente,
   * scopée à ces deux types pour préserver l'invariant de sécurité de la suppression
   * physique d'un achat de la session, cf. Game.changeEquipment/canAccept en ATELIER).
   *
   * execute()/undo() tranchent sur DEUX axes indépendants, volontairement séparés en deux
   * `if` successifs plutôt qu'un seul enchaînement if/else-if/else : d'abord l'opération
   * (BUY vs SELL), puis — seulement pour SELL — le type d'entité (VEHICLE vs le reste).
   * BUY se comporte identiquement quel que soit le type d'entité, d'où le retour anticipé.
   */
  execute(participants: CampaignParticipant[]): void {
    const p = this.findParticipant(participants);
    if (this.operation === EquipmentOperation.BUY) {
      this.createTransientEquipment(p, -this.id);
      return;
    }
    // SELL : VEHICULE reste sur le modèle "suppression complète" (ci-dessus) ;
    // WEAPON/IMPROVEMENT passent au modèle "flag isSold" (revente pré-existante).
    if (this.entityType === EquipmentEntityType.VEHICLE) {
      this.removeTransientEquipment(p, this.targetEntityId!);
    } else {
      this.markSoldEntity(p, this.targetEntityId!);
    }
  }

  undo(participants: CampaignParticipant[]): void {
    const p = this.findParticipant(participants);
    if (this.operation === EquipmentOperation.BUY) {
      this.removeTransientEquipment(p, -this.id);
      return;
    }
    // SELL : miroir exact d'execute() ci-dessus.
    if (this.entityType === EquipmentEntityType.VEHICLE) {
      this.createTransientEquipment(p, this.targetEntityId!);
    } else {
      this.clearSoldEntity(p, this.targetEntityId!);
    }
  }

  /** Recrée l'entité transiente (Vehicle/Weapon/Improvement) avec l'id fourni (achat, ou annulation d'une revente VEHICULE). */
  private createTransientEquipment(p: CampaignParticipant, entityId: number): void {
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

  /** Retire l'entité transiente ciblée (annulation d'un achat, ou revente VEHICULE). */
  private removeTransientEquipment(p: CampaignParticipant, entityId: number): void {
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

  /** Flague l'entité ciblée "vendue" (WEAPON/IMPROVEMENT uniquement — revente pré-existante). */
  private markSoldEntity(p: CampaignParticipant, entityId: number): void {
    if (this.entityType === EquipmentEntityType.WEAPON) {
      p.team.markWeaponSold(this.targetVehicleId!, entityId);
    } else {
      p.team.markImprovementSold(this.targetVehicleId!, entityId);
    }
  }

  /** Undo de markSoldEntity. */
  private clearSoldEntity(p: CampaignParticipant, entityId: number): void {
    if (this.entityType === EquipmentEntityType.WEAPON) {
      p.team.clearWeaponSold(this.targetVehicleId!, entityId);
    } else {
      p.team.clearImprovementSold(this.targetVehicleId!, entityId);
    }
  }

  describe(participants: readonly CampaignParticipant[]): string {
    const verb = this.operation === EquipmentOperation.BUY ? 'Achat' : 'Vente';
    const nom = this.resolvedWeaponType?.nom
      ?? this.resolvedImprovementType?.nom
      ?? this.resolvedVehicleType?.nom
      ?? this.nomInterne;

    const details: string[] = [];
    if (this.orientation) details.push(this.orientation);
    if (this.entityType !== EquipmentEntityType.VEHICLE && this.targetVehicleId !== null) {
      const hostVehicle = this.findVehicleWithTeam(participants, this.targetVehicleId)?.vehicle;
      if (hostVehicle) details.push(`sur ${hostVehicle.type.nom}`);
    }
    const detailsText = details.join(', ');

    return `${verb} : ${nom}${detailsText ? ` (${detailsText})` : ''} (${this.cost} jerricans)`;
  }
}
