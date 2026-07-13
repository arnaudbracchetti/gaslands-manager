import { GameEvent } from './game-event';
import type { CampaignParticipant } from '../campaign-participant';
import type { VehicleType } from '../../../team/domain/value-objects/vehicle-type';
import type { WeaponType } from '../../../team/domain/value-objects/weapon-type';
import type { ImprovementType } from '../../../team/domain/value-objects/improvement-type';
import type { AdvantageType } from '../../../team/domain/value-objects/advantage-type';
import type { SequellaType } from '../../../team/domain/value-objects/sequella-type';
import type { Orientation, WeaponOrientation } from '../../../team/domain/team';
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
 * - BUY_SEQUELLE    : targetVehicleId=vehicleId, targetEntityId=null → crée Sequella id=-this.id ;
 *                     si nomInterne='dur_a_cuire' et resolvedFreeAdvantageType renseigné, crée AUSSI
 *                     un Advantage taggé (même id -this.id, tag `grantedBySequellaNomInterne`) — un
 *                     seul événement porte les deux effets, pour que l'annulation même-session
 *                     (suppression de CET événement) les défasse atomiquement tous les deux.
 * - SELL_VEHICLE    : targetVehicleId=null, targetEntityId=vehicleId → flague le véhicule "vendu" (isSold), cascade sur son équipement
 * - SELL_WEAPON     : targetVehicleId=vehicleId, targetEntityId=weaponId → flague l'arme "vendue" (isSold)
 * - SELL_IMPROVEMENT: targetVehicleId=vehicleId, targetEntityId=improvementId → flague l'amélioration "vendue" (isSold)
 * - SELL_SEQUELLE   : targetVehicleId=vehicleId, targetEntityId=sequellaId → flague la séquelle "vendue"
 *                     (isSold, toujours 0 remboursement) ; si nomInterne='dur_a_cuire', flague AUSSI
 *                     l'avantage taggé "vendu" (retrouvé par tag, pas par id — cf. `Vehicle.markGrantedAdvantageSold`)
 *
 * SELL_WEAPON/SELL_IMPROVEMENT/SELL_VEHICLE ne retirent plus l'entité : elle reste vendue
 * (flag `isSold`), remboursée à moitié prix par élément (cf. `Weapon.price`/
 * `Improvement.price`/`Vehicle.cost`, prix résiduel). Pour VEHICLE, `markSold()` cascade
 * sur toute arme/amélioration/avantage pas encore vendue (cf. sa doc, `team/domain/
 * vehicle.ts`) — un véhicule reste néanmoins filtré de la liste atelier exposée
 * (`GetWorkshopUseCase`), contrairement à une arme/amélioration vendue qui reste visible
 * barrée (badge "Vendue" côté IHM) : seule cette exposition diffère, le mécanisme
 * `isSold`/prix résiduel est désormais identique pour les 4 types d'entité. Un véhicule
 * acheté PENDANT la session d'atelier en cours n'emprunte pas ce chemin : `Game.
 * changeEquipment` le détecte en amont et bascule vers une annulation cascade
 * (suppression de tous les événements le référençant, cf.
 * `Game.collectSessionEventsForVehicle`), jamais une revente à moitié prix.
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
 *
 * **Pourquoi une seule classe avec un champ `entityType`, plutôt qu'une hiérarchie
 * (`WeaponChangeEvent`/`ImprovementChangeEvent`/`AdvantageChangeEvent`/...)** : `entityType`
 * discrimine ICI un même `eventType` DB (`EQUIPMENT_CHANGED`), contrairement à
 * `WeaponLostEvent`/`ImprovementLostEvent` qui sont deux `eventType` distincts avec chacun
 * sa propre classe — pas le même genre de choix. Découper cette classe déplacerait le
 * switch au lieu de l'éliminer : `campaign.mapper.ts:toEquipmentChangedEvent()` a déjà un
 * `if/else` sur `entityType` pour résoudre le bon Value Object catalogue ; avec une
 * hiérarchie, ce même `if/else` devrait en plus choisir QUELLE sous-classe instancier, et
 * s'imbriquer dans le switch externe de `toEvent()` (qui, pour tous les autres événements,
 * reste un mapping direct un-eventType-une-classe). Une hiérarchie romprait aussi le choix
 * documenté "table `GAME_EVENT` plate, pas de STI" (`docs/DOMAIN_MODEL.md` §3) et
 * dupliquerait la sémantique BUY/SELL — identique pour les 4 types d'entité — sur 4
 * classes séparées. Les méthodes `create/remove/markSold/clearSold` ci-dessous ne portent
 * pas de logique métier complexe (une ligne de délégation par cas) : les séparer
 * éparpillerait cette complexité au lieu de la réduire.
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
    /** WEAPON : 5 valeurs possibles (dont `'tourelle'`, arc à 360°, coût ×3, figée à
     *  l'achat). VEHICLE/IMPROVEMENT n'utilisent jamais `'tourelle'`. */
    readonly orientation: WeaponOrientation | null,
    private readonly resolvedVehicleType: VehicleType | null,
    private readonly resolvedWeaponType: WeaponType | null,
    private readonly resolvedImprovementType: ImprovementType | null = null,
    private readonly resolvedAdvantageType: AdvantageType | null = null,
    private readonly resolvedSequellaType: SequellaType | null = null,
    /** Renseigné uniquement pour BUY(SEQUELLE, 'dur_a_cuire') — avantage gratuit choisi à l'achat. */
    private readonly resolvedFreeAdvantageType: AdvantageType | null = null,
  ) {
    super(id, gameId, participantId, eventOrder);
  }

  /**
   * Le wallet n'est plus jamais touché ici : il est dérivé de `Team.remainingBudget`
   * (cf. `CampaignParticipant.wallet`) — un achat/une vente modifie l'arbre d'entités
   * (via createTransientEquipment/markSoldEntity/clearSoldEntity), ce qui suffit à
   * faire varier le budget restant, donc le wallet dérivé, du bon montant
   * automatiquement.
   *
   * VEHICLE suit désormais le même modèle "flag isSold" que WEAPON/IMPROVEMENT/
   * ADVANTAGE (`markSoldEntity`/`clearSoldEntity` ci-dessous) — `Vehicle.markSold()`
   * cascade sur son équipement pas encore vendu (cf. sa doc, `team/domain/vehicle.ts`).
   * `removeTransientEquipment` reste utilisé uniquement pour BUY (annulation d'achat,
   * même session) — jamais pour SELL, quel que soit `entityType`.
   *
   * execute()/undo() ne tranchent donc plus que sur UN seul axe (BUY vs SELL) —
   * l'ancien second `if` sur `entityType === VEHICLE` a disparu avec la suppression
   * physique qu'il déclenchait.
   *
   * SEQUELLE est la seule exception à "le wallet n'est plus jamais touché ici" : sa
   * monnaie (les Chocs du véhicule) n'est PAS dérivée d'un prix d'entité comme le
   * budget Jerricans — c'est un compteur mutable (`Vehicle.chocs`) qu'il faut donc
   * débiter/créditer explicitement, avant la mutation de l'arbre d'entités.
   */
  execute(participants: CampaignParticipant[]): void {
    const p = this.findParticipant(participants);
    this.applyChocsDelta(p, this.operation === EquipmentOperation.BUY ? -this.cost : this.cost);
    if (this.operation === EquipmentOperation.BUY) {
      this.createTransientEquipment(p, -this.id);
      return;
    }
    this.markSoldEntity(p, this.targetEntityId!);
  }

  undo(participants: CampaignParticipant[]): void {
    const p = this.findParticipant(participants);
    this.applyChocsDelta(p, this.operation === EquipmentOperation.BUY ? this.cost : -this.cost);
    if (this.operation === EquipmentOperation.BUY) {
      this.removeTransientEquipment(p, -this.id);
      return;
    }
    this.clearSoldEntity(p, this.targetEntityId!);
  }

  /** SEQUELLE uniquement — débite (BUY) ou crédite (SELL, refund) les Chocs du véhicule hôte. */
  private applyChocsDelta(p: CampaignParticipant, delta: number): void {
    if (this.entityType !== EquipmentEntityType.SEQUELLE) return;
    p.team.findVehicle(this.targetVehicleId!).addChocs(delta);
  }

  /** Recrée l'entité transiente (Vehicle/Weapon/Improvement/Advantage) avec l'id fourni — undo d'un achat (BUY) uniquement. */
  private createTransientEquipment(p: CampaignParticipant, entityId: number): void {
    switch (this.entityType) {
      case EquipmentEntityType.VEHICLE:
        p.team.addCampaignVehicle(this.resolvedVehicleType!, entityId);
        break;
      case EquipmentEntityType.WEAPON:
        p.team.addCampaignWeapon(this.targetVehicleId!, this.resolvedWeaponType!, this.orientation, entityId);
        break;
      case EquipmentEntityType.IMPROVEMENT:
        // Une amélioration ne porte jamais 'tourelle' — invariant garanti à la construction
        // de l'événement (jamais émis par le use case pour ce entityType).
        p.team.addCampaignImprovement(this.targetVehicleId!, this.resolvedImprovementType!, this.orientation as Orientation | null, entityId);
        break;
      case EquipmentEntityType.ADVANTAGE:
        p.team.addCampaignAdvantage(this.targetVehicleId!, this.resolvedAdvantageType!, entityId);
        break;
      case EquipmentEntityType.SEQUELLE:
        p.team.addCampaignSequella(this.targetVehicleId!, this.resolvedSequellaType!, entityId);
        // Dur à Cuire : un seul événement porte les deux effets (cf. doc de classe) — même
        // id transient que la séquelle, aucune collision possible (collections distinctes).
        if (this.resolvedFreeAdvantageType) {
          p.team.addCampaignAdvantage(this.targetVehicleId!, this.resolvedFreeAdvantageType, entityId, this.nomInterne);
        }
        break;
    }
  }

  /**
   * Retire l'entité transiente ciblée — annulation d'un achat de CETTE session
   * uniquement (undo de BUY, tous types d'entité confondus, VEHICLE compris). Une
   * revente d'entité PRÉ-EXISTANTE ne passe plus jamais par ici (cf. `markSoldEntity`
   * ci-dessous) — l'annulation cascade d'un véhicule acheté cette session emprunte un
   * chemin entièrement différent (`Game.collectSessionEventsForVehicle`, suppression
   * d'événements en base, jamais `undo()`).
   */
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
      case EquipmentEntityType.ADVANTAGE:
        p.team.removeCampaignAdvantage(this.targetVehicleId!, entityId);
        break;
      case EquipmentEntityType.SEQUELLE:
        p.team.removeCampaignSequella(this.targetVehicleId!, entityId);
        if (this.resolvedFreeAdvantageType) {
          p.team.removeCampaignAdvantage(this.targetVehicleId!, entityId);
        }
        break;
    }
  }

  /**
   * Flague l'entité ciblée "vendue" (revente pré-existante — les 4 types d'entité,
   * VEHICLE compris depuis que `Vehicle` porte `isSold`, cf. `team/domain/vehicle.ts`).
   * Pour VEHICLE, `targetVehicleId` est `null` (c'est le véhicule LUI-MÊME qui est
   * ciblé, pas un véhicule hôte) — `entityId` (= `targetEntityId`) est donc l'id du
   * véhicule à marquer vendu.
   */
  private markSoldEntity(p: CampaignParticipant, entityId: number): void {
    switch (this.entityType) {
      case EquipmentEntityType.VEHICLE:
        p.team.markVehicleSold(entityId);
        break;
      case EquipmentEntityType.WEAPON:
        p.team.markWeaponSold(this.targetVehicleId!, entityId);
        break;
      case EquipmentEntityType.IMPROVEMENT:
        p.team.markImprovementSold(this.targetVehicleId!, entityId);
        break;
      case EquipmentEntityType.ADVANTAGE:
        p.team.markAdvantageSold(this.targetVehicleId!, entityId);
        break;
      case EquipmentEntityType.SEQUELLE:
        p.team.markSequellaSold(this.targetVehicleId!, entityId);
        if (this.nomInterne === 'dur_a_cuire') {
          p.team.markGrantedAdvantageSold(this.targetVehicleId!, this.nomInterne);
        }
        break;
    }
  }

  /** Undo de markSoldEntity — même raisonnement, VEHICLE compris. */
  private clearSoldEntity(p: CampaignParticipant, entityId: number): void {
    switch (this.entityType) {
      case EquipmentEntityType.VEHICLE:
        p.team.clearVehicleSold(entityId);
        break;
      case EquipmentEntityType.WEAPON:
        p.team.clearWeaponSold(this.targetVehicleId!, entityId);
        break;
      case EquipmentEntityType.IMPROVEMENT:
        p.team.clearImprovementSold(this.targetVehicleId!, entityId);
        break;
      case EquipmentEntityType.ADVANTAGE:
        p.team.clearAdvantageSold(this.targetVehicleId!, entityId);
        break;
      case EquipmentEntityType.SEQUELLE:
        p.team.clearSequellaSold(this.targetVehicleId!, entityId);
        if (this.nomInterne === 'dur_a_cuire') {
          p.team.clearGrantedAdvantageSold(this.targetVehicleId!, this.nomInterne);
        }
        break;
    }
  }

  /** Nom interne de l'avantage gratuit accordé (Dur à Cuire uniquement) — persistance. */
  get freeAdvantageNomInterne(): string | null {
    return this.resolvedFreeAdvantageType?.nomInterne ?? null;
  }

  /**
   * Cet événement cible-t-il ce véhicule ? Un événement dont l'entité EST le véhicule
   * (BUY_VEHICLE/SELL_VEHICLE) n'a pas de `targetVehicleId` (il vaut `null` — c'est le
   * véhicule hôte des ARMES/AMÉLIORATIONS/AVANTAGES qui est porté ici, pas lui-même) et
   * ne matche donc jamais : c'est volontaire, `Game.collectSessionEventsForVehicle`
   * ajoute déjà explicitement l'id de l'événement d'achat du véhicule lui-même.
   */
  override targetsVehicle(vehicleId: number): boolean {
    return this.targetVehicleId === vehicleId;
  }

  describe(participants: readonly CampaignParticipant[]): string {
    const verb = this.operation === EquipmentOperation.BUY ? 'Achat' : 'Vente';
    const nom = this.resolvedWeaponType?.nom
      ?? this.resolvedImprovementType?.nom
      ?? this.resolvedAdvantageType?.nom
      ?? this.resolvedVehicleType?.nom
      ?? this.resolvedSequellaType?.nom
      ?? this.nomInterne;

    const details: string[] = [];
    if (this.orientation) details.push(this.orientation);
    if (this.entityType !== EquipmentEntityType.VEHICLE && this.targetVehicleId !== null) {
      const hostVehicle = this.findVehicleWithTeam(participants, this.targetVehicleId)?.vehicle;
      if (hostVehicle) details.push(`sur ${hostVehicle.type.nom}`);
    }
    if (this.resolvedFreeAdvantageType) details.push(`+ avantage ${this.resolvedFreeAdvantageType.nom}`);
    const detailsText = details.join(', ');

    // Monnaie affichée : Chocs pour une séquelle (véhicule), jerricans pour tout le reste (cagnotte).
    const monnaie = this.entityType === EquipmentEntityType.SEQUELLE ? 'chocs' : 'jerricans';
    return `${verb} : ${nom}${detailsText ? ` ${detailsText}` : ''} (${this.cost} ${monnaie})`;
  }
}
