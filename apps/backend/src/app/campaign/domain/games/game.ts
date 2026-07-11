import { DomainException } from '../../../shared/domain/domain-exception';
import type { GameEvent } from '../events/game-event';
import type { CampaignParticipant } from '../campaign-participant';
import { GameStatus } from '../enums/game-status.enum';
import { RankingAssignedEvent } from '../events/ranking-assigned.event';
import { GatesCrossedEvent } from '../events/gates-crossed.event';
import { VehicleDestroyedEvent } from '../events/vehicle-destroyed.event';
import { ResistanceContactedEvent } from '../events/resistance-contacted.event';
import { FavoriDuPublicBonusEvent } from '../events/favori-du-public-bonus.event';
import { WalletMovementEvent } from '../events/wallet-movement.event';
import { VehicleLostEvent } from '../events/vehicle-lost.event';
import { WeaponLostEvent } from '../events/weapon-lost.event';
import { SequellaAddedEvent } from '../events/sequella-added.event';
import { EquipmentChangedEvent } from '../events/equipment-changed.event';
import type { WalletReason } from '../enums/wallet-reason.enum';
import { EXPLOIT_POINTS_BY_WEIGHT, weightClassFromPoids } from '../enums/weight-class.enum';
import type { WreckTable, WreckTableResult } from '../wreck/wreck-table';
import type { VehicleType } from '../../../team/domain/value-objects/vehicle-type';
import type { WeaponType } from '../../../team/domain/value-objects/weapon-type';
import type { ImprovementType } from '../../../team/domain/value-objects/improvement-type';
import { EquipmentOperation, EquipmentEntityType } from '../enums/equipment-change.enums';
import { ParticipantStatus } from '../enums/campaign.enums';
import type { RankingInput, ChangeEquipmentInput, GameJournalEntry } from './game-commands';

// Points de Championnat attribués par rang (index 0 = rang 1). Rang 5+ → 0.
const POINTS_TABLE = [10, 5, 2, 1];

/** +5 PC — Table des Épaves, ligne 9 (Favori du public), effet différé confirmé ligne 10+. */
const FAVORI_DU_PUBLIC_BONUS_POINTS = 5;

/**
 * Partie de campagne — GoF Invoker.
 *
 * Classe abstraite commune à EvenementTeleGame et EscarmoucheGame. Maintient son
 * propre journal d'événements et délègue l'exécution à chaque commande.
 *
 * `canAccept(event)` est la règle métier du statut courant : les événements de
 * classement/exploits/épaves ne sont acceptés qu'en PLANIFIE, les événements
 * d'atelier (achat/revente/séquelle) uniquement en ATELIER — la phase garage
 * post-partie appartient à la partie elle-même, pas à une entité séparée.
 */
export abstract class Game {
  protected readonly _events: GameEvent[];
  // status / playedAt sont mutés par les transitions enterAtelier()/closeAtelier() —
  // privés pour que ces changements passent par des méthodes de domaine (plus de cast readonly).
  private _status: GameStatus;
  private _playedAt: Date | null;

  constructor(
    readonly id: number,
    readonly campaignId: number,
    status: GameStatus,
    readonly order: number,
    playedAt: Date | null,
    events: GameEvent[],
  ) {
    this._status = status;
    this._playedAt = playedAt;
    this._events = [...events].sort((a, b) => a.eventOrder - b.eventOrder);
  }

  get events(): readonly GameEvent[] { return this._events; }
  get status(): GameStatus { return this._status; }
  get playedAt(): Date | null { return this._playedAt; }

  /** Sous-type de partie. Utilisé par le mapper ORM pour l'hydratation STI. */
  abstract get type(): string;

  /**
   * Peut-on ajouter cet événement à cette partie, compte tenu de son statut
   * courant ? Implémenté par chaque sous-type. `addEvent` appelle cette
   * méthode avant d'ajouter.
   */
  abstract canAccept(event: GameEvent): boolean;

  /**
   * Valide et ajoute un événement au journal.
   * Le use case doit ensuite appeler `event.execute(participants)` lui-même.
   */
  addEvent(event: GameEvent): void {
    if (this._status === GameStatus.JOUE) {
      throw new DomainException(
        `Cette partie (${this.type}) est figée et n'accepte plus d'événements.`,
      );
    }
    if (!this.canAccept(event)) {
      throw new DomainException(
        `Cet événement n'est pas autorisé pour une partie de type ${this.type} en statut ${this._status}.`,
      );
    }
    this._events.push(event);
  }

  /** Transition PLANIFIE → ATELIER : résultat enregistré, phase garage ouverte. */
  enterAtelier(): void {
    if (this._status !== GameStatus.PLANIFIE) {
      throw new DomainException('Seule une partie PLANIFIE peut entrer en atelier.');
    }
    this._status = GameStatus.ATELIER;
    this._playedAt = new Date();
  }

  /** Transition ATELIER → JOUE : phase garage clôturée, la partie est figée. */
  closeAtelier(): void {
    if (this._status !== GameStatus.ATELIER) {
      throw new DomainException("Cette partie n'est pas en atelier.");
    }
    this._status = GameStatus.JOUE;
  }

  /**
   * Rejoue tous les événements dans l'ordre (ordre croissant d'eventOrder).
   */
  replayEvents(participants: CampaignParticipant[]): void {
    for (const event of this._events) {
      event.execute(participants);
    }
  }

  /**
   * Annule tous les événements dans l'ordre inverse.
   * Utilisé par Campaign.replayUpTo pour reconstruire un état partiel.
   */
  revert(participants: CampaignParticipant[]): void {
    for (const event of [...this._events].reverse()) {
      event.undo(participants);
    }
  }

  // ── Commandes — construction et journalisation des événements ─────────────────

  /**
   * Enregistre le résultat de cette partie : calcule les PC, journalise un
   * `RankingAssignedEvent` par participant (+ exploits/résistance). Ne fait PAS
   * entrer la partie en atelier — cf. `Campaign.enterAtelier()`, action séparée.
   * Les événements créés portent id=0 ; le use case les persiste via `appendEvents`.
   */
  recordResult(rankings: RankingInput[], participants: readonly CampaignParticipant[]): GameEvent[] {
    if (this._status !== GameStatus.PLANIFIE) {
      throw new DomainException('Cette partie a déjà été jouée.');
    }

    // Rangs uniques et consécutifs à partir de 1.
    const ranks = rankings.map((r) => r.rank).sort((a, b) => a - b);
    const duplicates = new Set(ranks).size !== ranks.length;
    const consecutive = ranks.every((r, i) => r === i + 1);
    if (duplicates || !consecutive) {
      throw new DomainException('Les rangs doivent être uniques et consécutifs à partir de 1.');
    }

    // Participants VALIDATED uniquement.
    const validatedIds = new Set(
      participants.filter((p) => p.status === ParticipantStatus.VALIDATED).map((p) => p.id),
    );
    for (const r of rankings) {
      if (!validatedIds.has(r.participantId)) {
        throw new DomainException(`Participant ${r.participantId} inconnu ou non validé dans cette campagne.`);
      }
    }

    // Calcul des PC de classement selon le type de partie, puis événements de rang.
    const classified = Math.ceil(rankings.length / 2);
    const events: GameEvent[] = [];
    for (const r of rankings) {
      const points = this.computePoints(r.rank, classified);
      const rankingEvent = new RankingAssignedEvent(0, this.id, r.participantId, 0, r.rank, points);
      this.addEvent(rankingEvent);
      events.push(rankingEvent);

      // Points de Résistance automatiques (US-F1) : tout participant non classé (hors du
      // top `classified`) reçoit +3 PR secrets, même s'il a marqué des PC d'exploit —
      // aucune saisie manuelle, l'organisateur n'a pas d'écran dédié pour cette étape.
      if (r.rank > classified) {
        const resistanceEvent = new ResistanceContactedEvent(0, this.id, r.participantId, 0);
        this.addEvent(resistanceEvent);
        events.push(resistanceEvent);
      }

      // Exploits (US-B2) : portes franchies + véhicules ennemis détruits par poids.
      // PC figés à l'écriture (D-S8), comme pour le classement.
      if (r.gatesCrossed && r.gatesCrossed > 0) {
        const gatesEvent = new GatesCrossedEvent(0, this.id, r.participantId, 0, r.gatesCrossed, r.gatesCrossed);
        this.addEvent(gatesEvent);
        events.push(gatesEvent);
      }
      for (const destroyed of r.destroyedVehicles ?? []) {
        // weightClass dérivé du véhicule réel (jamais transmis par l'appelant) — cf.
        // DestroyedVehicleInput.
        const weightClass = weightClassFromPoids(
          this.findVehicleTypeAcrossParticipants(participants, destroyed.vehicleId).poids,
        );
        const exploitPoints = EXPLOIT_POINTS_BY_WEIGHT[weightClass];
        const destroyedEvent = new VehicleDestroyedEvent(
          0, this.id, r.participantId, 0, destroyed.vehicleId, weightClass, exploitPoints,
        );
        this.addEvent(destroyedEvent);
        events.push(destroyedEvent);
      }
    }

    return events;
  }

  /**
   * Wrapper mince : trouve le véhicule dans l'équipe du participant, délègue à
   * `WreckTable` (qui encapsule les 9 lignes + la création des événements), puis
   * journalise les événements retournés. Ne connaît PAS la Faveur du Public — règle
   * indépendante, cf. `creditFavoriDuPublicBonus()`. Les événements créés portent
   * id=0 ; le use case les persiste via `appendEvents`.
   */
  resolveWreck(participant: CampaignParticipant, vehicleId: number, wreckTable: WreckTable): WreckTableResult {
    const vehicle = participant.team.findVehicle(vehicleId);
    const result = wreckTable.resolve(vehicle, this.id, participant.id);
    for (const event of result.events) this.addEvent(event);
    return result;
  }

  /**
   * Règle indépendante du tirage de la Table des Épaves : crédite +5 PC au
   * propriétaire d'un véhicule attesté "Favori du public" (par l'organisateur, lors
   * d'une partie précédente) lorsque ce véhicule vient d'être détruit.
   * `vehicleWasDestroyed` est un fait déjà établi par l'appelant (résultat de
   * `resolveWreck` ci-dessus) — cette méthode ne réinterprète pas la table, elle
   * applique une règle séparée sur ce fait.
   */
  creditFavoriDuPublicBonus(participantId: number, vehicleId: number, vehicleWasDestroyed: boolean): GameEvent | null {
    if (!vehicleWasDestroyed) return null;
    const bonusEvent = new FavoriDuPublicBonusEvent(0, this.id, participantId, 0, vehicleId, FAVORI_DU_PUBLIC_BONUS_POINTS);
    this.addEvent(bonusEvent);
    return bonusEvent;
  }

  /**
   * Achat ou revente d'équipement en atelier (D1-D3). Calcule le coût selon
   * opération × type d'entité, et vérifie la cagnotte (BUY uniquement — la revente
   * crédite toujours).
   *
   * Ne fait PAS `event.execute()` (D-S11) : l'id de l'entité transiente créée par
   * un achat est `-event.id`, or l'id n'est assigné qu'après persistance — l'appelant
   * persiste l'événement puis recharge via replay, qui l'applique avec son vrai id.
   */
  changeEquipment(participant: CampaignParticipant, cmd: ChangeEquipmentInput): GameEvent[] {
    // Le coût est calculé ici puis figé dans l'événement : en event-sourcing il ne doit
    // jamais être recalculé au replay (le prix catalogue peut changer, le coût de revente
    // dépend de l'état rejoué).
    //
    // Pour un BUY, `nomInterne` et les types résolus viennent du catalogue (fournis par le
    // use case). Pour un SELL, on les DÉRIVE de l'entité ciblée dans l'équipe replayée : le
    // client n'a pas à (re)transmettre le `nomInterne` de ce qu'il vend. L'événement reste
    // ainsi auto-descriptif — le mapper de replay résout toujours un catalogue valide, et
    // l'undo peut recréer l'entité (symétrie avec le BUY).
    let cost: number;
    let nomInterne: string = cmd.nomInterne;
    let resolvedVehicleType: VehicleType | null = cmd.resolvedVehicleType;
    let resolvedWeaponType: WeaponType | null = cmd.resolvedWeaponType;
    let resolvedImprovementType: ImprovementType | null = cmd.resolvedImprovementType;

    if (cmd.operation === EquipmentOperation.BUY) {
      cost = this.resolveBuyCost(cmd);
    } else {
      const sold = this.resolveSell(participant, cmd);
      cost = sold.cost;
      nomInterne = sold.nomInterne;
      resolvedVehicleType = sold.resolvedVehicleType;
      resolvedWeaponType = sold.resolvedWeaponType;
      resolvedImprovementType = sold.resolvedImprovementType;
    }

    const event = new EquipmentChangedEvent(
      0, this.id, participant.id, 0,
      cmd.operation, cmd.entityType, nomInterne, cost,
      cmd.targetVehicleId ?? null, cmd.targetEntityId ?? null, cmd.orientation ?? null,
      resolvedVehicleType, resolvedWeaponType, resolvedImprovementType,
    );

    if (cmd.operation === EquipmentOperation.BUY) participant.assertCanAfford(cost);
    this.addEvent(event);

    return [event];
  }

  /** F1 — Enregistre qu'un participant a contacté la Résistance (+3 PR secrets). */
  contactResistance(participantId: number): GameEvent[] {
    const event = new ResistanceContactedEvent(0, this.id, participantId, 0);
    this.addEvent(event);
    return [event];
  }

  /** B3 — Enregistre un mouvement de cagnotte (gain de récompense ou dépense d'atelier). */
  recordWalletMovement(participantId: number, amount: number, reason: WalletReason): GameEvent[] {
    const event = new WalletMovementEvent(0, this.id, participantId, 0, amount, reason);
    this.addEvent(event);
    return [event];
  }

  /**
   * Enregistre la perte d'un véhicule (et optionnellement de ses armes) pendant
   * cette partie.
   */
  recordVehicleLost(participantId: number, vehicleId: number, weaponIds?: number[]): GameEvent[] {
    const events: GameEvent[] = [];
    const vehicleEvent = new VehicleLostEvent(0, this.id, participantId, 0, vehicleId);
    this.addEvent(vehicleEvent);
    events.push(vehicleEvent);

    for (const weaponId of weaponIds ?? []) {
      const weaponEvent = new WeaponLostEvent(0, this.id, participantId, 0, weaponId);
      this.addEvent(weaponEvent);
      events.push(weaponEvent);
    }

    return events;
  }

  /**
   * D4/E4 — Échange des Chocs contre une séquelle permanente en atelier. `chocsCost`
   * est déjà résolu par l'appelant (registre des séquelles, `SEQUELLA_REGISTRY`,
   * cf. `team/domain/sequella-decorators` — hors du domaine campagne).
   * `SequellaAddedEvent.execute()` valide les Chocs disponibles via `vehicle.addChocs(-n)` ;
   * si insuffisants, `DomainException` levée.
   */
  addSequella(participant: CampaignParticipant, vehicleId: number, sequellaTypeNom: string, chocsCost: number): GameEvent[] {
    const event = new SequellaAddedEvent(0, this.id, participant.id, 0, vehicleId, sequellaTypeNom, chocsCost);
    this.addEvent(event);
    return [event];
  }

  /** Journal complet de cette partie — chaque événement traduit en texte lisible. */
  journal(participants: readonly CampaignParticipant[]): GameJournalEntry[] {
    return this._events.map((e) => ({
      eventId: e.id,
      participantId: e.participantId,
      description: e.describe(participants),
    }));
  }

  // ── Helpers privés ────────────────────────────────────────────────────────────

  private computePoints(rank: number, classified: number): number {
    if (this.type !== 'EVENEMENT_TELE') return 0;  // ESCARMOUCHE et autres : aucun PC
    if (rank > classified) return 0;
    return POINTS_TABLE[rank - 1] ?? 0;
  }

  /**
   * Retrouve le type catalogue d'un véhicule en cherchant dans toutes les équipes de
   * la campagne (un véhicule ennemi n'appartient jamais au destructeur). Lève
   * `DomainException` si aucune équipe ne le possède — empêche de créditer des PC
   * pour un `vehicleId` inventé.
   */
  private findVehicleTypeAcrossParticipants(participants: readonly CampaignParticipant[], vehicleId: number): VehicleType {
    for (const p of participants) {
      if (!p.hasTeam) continue;
      try {
        return p.team.findVehicle(vehicleId).type;
      } catch {
        // Absent de cette équipe — on continue la recherche dans les autres.
      }
    }
    throw new DomainException(`Véhicule #${vehicleId} introuvable dans la campagne.`);
  }

  /** Coût d'un achat (BUY) selon le type d'entité — depuis le catalogue résolu. */
  private resolveBuyCost(cmd: ChangeEquipmentInput): number {
    switch (cmd.entityType) {
      case EquipmentEntityType.VEHICLE:
        if (!cmd.resolvedVehicleType) {
          throw new DomainException(`Véhicule inconnu du catalogue : "${cmd.nomInterne}".`);
        }
        return cmd.resolvedVehicleType.price;
      case EquipmentEntityType.WEAPON:
        if (!cmd.resolvedWeaponType) {
          throw new DomainException(`Arme inconnue du catalogue : "${cmd.nomInterne}".`);
        }
        return cmd.resolvedWeaponType.price;
      case EquipmentEntityType.IMPROVEMENT:
        if (!cmd.resolvedImprovementType) {
          throw new DomainException(`Amélioration inconnue du catalogue : "${cmd.nomInterne}".`);
        }
        // Temps 1 : la Tourelle (prix variable ×3 + assignation d'arme) n'est pas gérée en atelier.
        if (cmd.resolvedImprovementType.isTourelle) {
          throw new DomainException("La Tourelle n'est pas disponible en atelier pour l'instant.");
        }
        return cmd.resolvedImprovementType.price;
    }
  }

  /**
   * Revente (SELL) — lit l'entité ciblée dans l'équipe replayée et en dérive le coût, le
   * `nomInterne` et le Value Object de type. Ces derniers rendent l'événement auto-descriptif
   * (le client n'a pas à transmettre le `nomInterne` de ce qu'il vend) et réversibles (undo).
   */
  private resolveSell(
    participant: CampaignParticipant,
    cmd: ChangeEquipmentInput,
  ): {
    cost: number;
    nomInterne: string;
    resolvedVehicleType: VehicleType | null;
    resolvedWeaponType: WeaponType | null;
    resolvedImprovementType: ImprovementType | null;
  } {
    switch (cmd.entityType) {
      case EquipmentEntityType.VEHICLE: {
        const vehicle = participant.team.findVehicle(cmd.targetEntityId!);
        return {
          cost: vehicle.type.price,
          nomInterne: vehicle.type.nomInterne,
          resolvedVehicleType: vehicle.type,
          resolvedWeaponType: null,
          resolvedImprovementType: null,
        };
      }
      case EquipmentEntityType.WEAPON: {
        const weapon = participant.team.findVehicle(cmd.targetVehicleId!).weapons.find((w) => w.id === cmd.targetEntityId);
        if (!weapon) throw new DomainException(`Arme ${cmd.targetEntityId} introuvable.`);
        return {
          cost: weapon.type.price,
          nomInterne: weapon.type.nomInterne,
          resolvedVehicleType: null,
          resolvedWeaponType: weapon.type,
          resolvedImprovementType: null,
        };
      }
      case EquipmentEntityType.IMPROVEMENT: {
        const improvement = participant.team
          .findVehicle(cmd.targetVehicleId!)
          .improvements.find((i) => i.id === cmd.targetEntityId);
        if (!improvement) throw new DomainException(`Amélioration ${cmd.targetEntityId} introuvable.`);
        // Garde validée dès la commande pour éviter un événement « poison » au replay ;
        // Vehicle.removeImprovement la re-vérifie en défense à l'exécution.
        if (improvement.estDefaut) {
          throw new DomainException('Les améliorations intégrées au profil de base ne peuvent pas être revendues.');
        }
        return {
          cost: improvement.price,
          nomInterne: improvement.type.nomInterne,
          resolvedVehicleType: null,
          resolvedWeaponType: null,
          resolvedImprovementType: improvement.type,
        };
      }
    }
  }
}
