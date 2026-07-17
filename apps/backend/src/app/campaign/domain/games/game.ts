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
import { EquipmentChangedEvent } from '../events/equipment-changed.event';
import { WalletReason } from '../enums/wallet-reason.enum';
import { EXPLOIT_POINTS_BY_WEIGHT, weightClassFromPoids } from '../enums/weight-class.enum';
import type { WreckTable, WreckTableResult } from '../wreck/wreck-table';
import type { IRandomizer } from '../randomizer.interface';
import type { VehicleType } from '../../../team/domain/value-objects/vehicle-type';
import type { WeaponType } from '../../../team/domain/value-objects/weapon-type';
import type { ImprovementType } from '../../../team/domain/value-objects/improvement-type';
import type { AdvantageType } from '../../../team/domain/value-objects/advantage-type';
import type { SequellaType } from '../../../team/domain/value-objects/sequella-type';
import type { WeaponOrientation } from '../../../team/domain/team';
import { EquipmentOperation, EquipmentEntityType } from '../enums/equipment-change.enums';
import { ParticipantStatus } from '../enums/campaign.enums';
import type { RankingInput, ChangeEquipmentInput, GameJournalEntry, ChangeEquipmentResult } from './game-commands';

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
    // Le classement (rangs, PC, Résistance) n'existe que pour les Événements Télévisés —
    // une Escarmouche utilise `recordJerricanGains`/`recordDestroyedVehicleTraces` à la
    // place (revenu D6 + trace de destruction sans PC, cf. spec/CAMPAIGN.md).
    if (this.type !== 'EVENEMENT_TELE') {
      throw new DomainException('Le classement ne s\'enregistre que pour un Événement Télévisé.');
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
   * crédite toujours, via le prix résiduel qui fait varier le budget dérivé).
   *
   * Annulation vs revente : si l'objet ciblé par un SELL a été acheté PENDANT cette même
   * session d'atelier (son événement BUY est encore dans `this._events`), le retrait est
   * une annulation pure — aucun événement de vente n'est créé, remboursement intégral et
   * invisible au journal (cf. `findSameSessionPurchase`). Pour WEAPON/IMPROVEMENT/ADVANTAGE,
   * seul l'événement BUY de l'objet est supprimé. Pour VEHICLE, l'annulation doit être une
   * CASCADE : supprimer aussi tout événement de cette session qui référence ce véhicule
   * (armes/améliorations/avantages montés dessus, séquelles) — sinon le PROCHAIN replay
   * rejouerait un événement ciblant un véhicule qui n'existe plus (`Team.findVehicle` lève
   * alors une `DomainException`, cassant tout le replay de la campagne). Cf.
   * `collectSessionEventsForVehicle`.
   *
   * Ne fait PAS `event.execute()` (D-S11) : l'id de l'entité transiente créée par
   * un achat est `-event.id`, or l'id n'est assigné qu'après persistance — l'appelant
   * persiste l'événement puis recharge via replay, qui l'applique avec son vrai id.
   */
  changeEquipment(participant: CampaignParticipant, cmd: ChangeEquipmentInput): ChangeEquipmentResult {
    // Pour un BUY, `nomInterne` et les types résolus viennent du catalogue (fournis par le
    // use case). Pour un SELL, on les DÉRIVE de l'entité ciblée dans l'équipe replayée : le
    // client n'a pas à (re)transmettre le `nomInterne` de ce qu'il vend. L'événement reste
    // ainsi auto-descriptif — le mapper de replay résout toujours un catalogue valide, et
    // l'undo peut recréer l'entité (symétrie avec le BUY).
    let cost: number;
    let nomInterne: string = cmd.nomInterne;
    let orientation: WeaponOrientation | null = cmd.orientation ?? null;
    let resolvedVehicleType: VehicleType | null = cmd.resolvedVehicleType;
    let resolvedWeaponType: WeaponType | null = cmd.resolvedWeaponType;
    let resolvedImprovementType: ImprovementType | null = cmd.resolvedImprovementType;
    let resolvedAdvantageType: AdvantageType | null = cmd.resolvedAdvantageType;
    let resolvedSequellaType: SequellaType | null = cmd.resolvedSequellaType;
    // Uniquement pertinent pour BUY(SEQUELLE, 'dur_a_cuire') — ignoré silencieusement
    // pour toute autre combinaison plutôt que de rejeter un champ superflu.
    const resolvedFreeAdvantageType: AdvantageType | null =
      cmd.entityType === EquipmentEntityType.SEQUELLE && cmd.nomInterne === 'dur_a_cuire'
        ? cmd.resolvedFreeAdvantageType
        : null;

    if (cmd.operation === EquipmentOperation.BUY) {
      cost = this.resolveBuyCost(cmd);
    } else if (cmd.operation === EquipmentOperation.SELL) {
      // Objet acheté PENDANT cette session d'atelier : annulation, vérifiée AVANT tout
      // calcul de remboursement (resolveSell lirait sinon un état sur le point de
      // disparaître intégralement). Même contrôle pour les 5 types d'entité — seule la
      // liste d'ids à supprimer diffère (cascade pour VEHICLE, cf. collectSessionEventsForVehicle).
      const buyEvent = this.findSameSessionPurchase(cmd.entityType, cmd.targetEntityId!);
      if (buyEvent) {
        const deleteEventIds = cmd.entityType === EquipmentEntityType.VEHICLE
          ? this.collectSessionEventsForVehicle(cmd.targetEntityId!, buyEvent.id)
          : [buyEvent.id];
        return { events: [], deleteEventIds };
      }

      const sold = this.resolveSell(participant, cmd);
      cost = sold.refund;
      nomInterne = sold.nomInterne;
      // Comme `nomInterne`/`resolvedWeaponType` ci-dessus : le client ne retransmet pas
      // l'orientation d'un objet qu'il revend (il n'envoie que son id), elle est donc
      // RÉSOLUE depuis l'entité réelle plutôt que lue sur `cmd.orientation` (toujours
      // absent pour un SELL) — sinon `describe()` affiche une vente sans orientation
      // même quand l'objet vendu en a une.
      orientation = sold.orientation;
      resolvedVehicleType = sold.resolvedVehicleType;
      resolvedWeaponType = sold.resolvedWeaponType;
      resolvedImprovementType = sold.resolvedImprovementType;
      resolvedAdvantageType = sold.resolvedAdvantageType;
      resolvedSequellaType = sold.resolvedSequellaType;
    } else {
      throw new DomainException(`Opération d'équipement inconnue : "${cmd.operation}".`);
    }

    const event = new EquipmentChangedEvent(
      0, this.id, participant.id, 0,
      cmd.operation, cmd.entityType, nomInterne, cost,
      cmd.targetVehicleId ?? null, cmd.targetEntityId ?? null, orientation,
      resolvedVehicleType, resolvedWeaponType, resolvedImprovementType, resolvedAdvantageType,
      resolvedSequellaType, resolvedFreeAdvantageType,
      cmd.resolvedDefaultImprovementTypes ?? [], cmd.resolvedDefaultWeaponType ?? null,
    );

    // SEQUELLE est réglée en Chocs (monnaie du véhicule) — pas la cagnotte — et porte
    // sa propre garde de domaine (origine/unicité/Chocs suffisants), contrairement aux
    // 4 autres types qui ne sont aujourd'hui gardés qu'au budget (limitation connue,
    // cf. docs/spec/CAMPAIGN.md).
    if (cmd.operation === EquipmentOperation.BUY) {
      if (cmd.entityType === EquipmentEntityType.SEQUELLE) {
        participant.team
          .findVehicle(cmd.targetVehicleId!)
          .assertCanAddSequella(resolvedSequellaType!, resolvedFreeAdvantageType);
      } else {
        participant.assertCanAfford(cost);
      }
    }
    this.addEvent(event);

    return { events: [event], deleteEventIds: [] };
  }

  /**
   * Toutes les ids d'événements à supprimer pour annuler INTÉGRALEMENT un véhicule acheté
   * cette session : l'achat du véhicule lui-même, PLUS tout événement de cette partie qui
   * le référence (achats/reventes d'armes/améliorations/avantages montés dessus depuis,
   * séquelles ajoutées) — sinon le PROCHAIN replay rejouerait un événement ciblant un
   * véhicule qui n'existe plus (`Team.findVehicle` lève une `DomainException`, cassant
   * tout le replay de la campagne). L'appelant supprime ce tableau en une seule opération
   * atomique (`ICampaignRepository.deleteEvents`, `DELETE ... WHERE id IN (...)`) — pas de
   * fenêtre où certains événements de ce véhicule seraient supprimés et d'autres non.
   */
  private collectSessionEventsForVehicle(vehicleId: number, buyEventId: number): number[] {
    const related = this._events.filter((e) => e.targetsVehicle(vehicleId)).map((e) => e.id);
    return [buyEventId, ...related];
  }

  /**
   * Un objet WEAPON/IMPROVEMENT/ADVANTAGE/VEHICLE ciblé par un SELL a-t-il été acheté PENDANT cette partie
   * (session d'atelier en cours) ? Recherche dans `this._events` — déjà scopé à la partie
   * courante, donc à la session en cours (un `Game` ne peut entrer en ATELIER qu'une seule
   * fois dans sa vie). L'id transient d'une entité achetée est `-event.id` (D-S11).
   */
  private findSameSessionPurchase(entityType: EquipmentEntityType, entityId: number): EquipmentChangedEvent | null {
    return this._events.find(
      (e): e is EquipmentChangedEvent =>
        e instanceof EquipmentChangedEvent &&
        e.operation === EquipmentOperation.BUY &&
        e.entityType === entityType &&
        -e.id === entityId,
    ) ?? null;
  }

  /** Point d'entrée public en lecture (GetWorkshopUseCase) — cf. `findSameSessionPurchase`. */
  wasPurchasedThisSession(entityType: EquipmentEntityType, entityId: number): boolean {
    return this.findSameSessionPurchase(entityType, entityId) !== null;
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
   * Escarmouche uniquement — revenu de base : un jet de D6 crédité en jerricans à un
   * participant présent. Différé en fin de wizard (phase de résolution), tiré une fois
   * par participant, en même temps que les tirages de la Table des Épaves — même aléa
   * serveur autoritaire (cf. spec/CAMPAIGN.md — Wizard de fin de partie). Délègue
   * entièrement à `recordWalletMovement` une fois le dé tiré : aucune règle propre à
   * porter au-delà de "revenu = 1D6".
   */
  rollBaseIncome(participantId: number, randomizer: IRandomizer): GameEvent[] {
    const amount = randomizer.roll(6);
    return this.recordWalletMovement(participantId, amount, WalletReason.RECOMPENSE);
  }

  /**
   * Escarmouche uniquement — butin manuel de jerricans (scénario `gain_jerricans`),
   * saisi par l'organisateur et cumulable avec le revenu de base (`rollBaseIncome`).
   * Boucle sur `recordWalletMovement`, comme `recordResult` boucle sur les rangs.
   */
  recordJerricanGains(gains: { participantId: number; amount: number }[]): GameEvent[] {
    const events: GameEvent[] = [];
    for (const gain of gains) {
      events.push(...this.recordWalletMovement(gain.participantId, gain.amount, WalletReason.RECOMPENSE));
    }
    return events;
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
   * Escarmouche uniquement — trace la destruction de véhicules ennemis dans le journal,
   * SANS effet sur les PC (contrairement à l'exploit ET de `recordResult`,
   * `championshipPoints` figé à 0). Le poids est dérivé côté serveur depuis le véhicule
   * réel (jamais transmis par l'appelant), même garde que `recordResult` — réutilise
   * `VehicleDestroyedEvent`, aucun nouveau type d'événement.
   */
  recordDestroyedVehicleTraces(
    destroyed: { destroyerId: number; vehicleId: number }[],
    participants: readonly CampaignParticipant[],
  ): GameEvent[] {
    const events: GameEvent[] = [];
    for (const d of destroyed) {
      const weightClass = weightClassFromPoids(
        this.findVehicleTypeAcrossParticipants(participants, d.vehicleId).poids,
      );
      const event = new VehicleDestroyedEvent(0, this.id, d.destroyerId, 0, d.vehicleId, weightClass, 0);
      this.addEvent(event);
      events.push(event);
    }
    return events;
  }

  /** Journal complet de cette partie — chaque événement traduit en texte lisible. */
  journal(participants: readonly CampaignParticipant[]): GameJournalEntry[] {
    return this._events.map((e) => ({
      eventId: e.id,
      participantId: e.participantId,
      description: e.describe(participants),
    }));
  }

  /**
   * Ids de TOUS les événements de cette partie — pour annuler le wizard de fin de
   * partie en cours de résolution (persistance différée, cf. spec/CAMPAIGN.md).
   * Réservé à une partie encore PLANIFIE : au-delà, la partie est entrée en atelier
   * (`enterAtelier`) et porte déjà des événements d'atelier qu'un reset ne doit pas
   * effacer silencieusement.
   */
  resultEventIdsForReset(): number[] {
    if (this._status !== GameStatus.PLANIFIE) {
      throw new DomainException('Seule une partie PLANIFIE peut être réinitialisée.');
    }
    return this._events.map((e) => e.id);
  }

  // ── Helpers privés ────────────────────────────────────────────────────────────

  // this.type === 'EVENEMENT_TELE' garanti par la garde en tête de recordResult
  // (seul appelant) — aucune Escarmouche n'atteint jamais ce calcul.
  private computePoints(rank: number, classified: number): number {
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
      case EquipmentEntityType.WEAPON: {
        if (!cmd.resolvedWeaponType) {
          throw new DomainException(`Arme inconnue du catalogue : "${cmd.nomInterne}".`);
        }
        const montageTourelle = cmd.orientation === 'tourelle';
        if (montageTourelle && !cmd.resolvedWeaponType.montableSurTourelle) {
          throw new DomainException('Cette arme ne peut pas être montée sur Tourelle.');
        }
        return cmd.resolvedWeaponType.price * (montageTourelle ? 3 : 1);
      }
      case EquipmentEntityType.IMPROVEMENT:
        if (!cmd.resolvedImprovementType) {
          throw new DomainException(`Amélioration inconnue du catalogue : "${cmd.nomInterne}".`);
        }
        return cmd.resolvedImprovementType.price;
      case EquipmentEntityType.ADVANTAGE:
        if (!cmd.resolvedAdvantageType) {
          throw new DomainException(`Avantage inconnu du catalogue : "${cmd.nomInterne}".`);
        }
        return cmd.resolvedAdvantageType.price;
      case EquipmentEntityType.SEQUELLE:
        if (!cmd.resolvedSequellaType) {
          throw new DomainException(`Séquelle inconnue du catalogue : "${cmd.nomInterne}".`);
        }
        return cmd.resolvedSequellaType.chocsCost;
    }
  }

  /**
   * Revente (SELL) — localise l'entité ciblée dans l'équipe rejouée et en dérive
   * `nomInterne`/orientation/type catalogue (le client ne transmet qu'un id) et le montant
   * remboursé, délégué à `entity.resaleRefund` (règle métier propre à chaque entité).
   * Peuple la structure plate à 4 champs `resolved*Type`, miroir de `GAME_EVENT` sans STI
   * (ARCHITECTURE.md §3.8).
   */
  private resolveSell(
    participant: CampaignParticipant,
    cmd: ChangeEquipmentInput,
  ): {
    refund: number;
    nomInterne: string;
    orientation: WeaponOrientation | null;
    resolvedVehicleType: VehicleType | null;
    resolvedWeaponType: WeaponType | null;
    resolvedImprovementType: ImprovementType | null;
    resolvedAdvantageType: AdvantageType | null;
    resolvedSequellaType: SequellaType | null;
  } {
    switch (cmd.entityType) {
      case EquipmentEntityType.VEHICLE: {
        const vehicle = participant.team.findVehicle(cmd.targetEntityId!);
        return {
          refund: vehicle.resaleRefund,
          nomInterne: vehicle.type.nomInterne,
          orientation: null,
          resolvedVehicleType: vehicle.type,
          resolvedWeaponType: null,
          resolvedImprovementType: null,
          resolvedAdvantageType: null,
          resolvedSequellaType: null,
        };
      }
      case EquipmentEntityType.WEAPON: {
        const weapon = this.assertSellable(
          participant.team.findVehicle(cmd.targetVehicleId!).weapons.find((w) => w.id === cmd.targetEntityId),
          cmd.targetEntityId!,
          'Arme',
          'Les armes intégrées au profil de base ne peuvent pas être revendues.',
        );
        return {
          refund: weapon.resaleRefund,
          nomInterne: weapon.type.nomInterne,
          // L'orientation de l'arme VENDUE — jamais transmise par le client (qui n'envoie
          // que l'id de l'objet à vendre) — doit être RÉSOLUE ici depuis l'entité réelle,
          // au même titre que `nomInterne`/`resolvedWeaponType` ci-dessus. Sans cela,
          // `describe()` (EquipmentChangedEvent) affiche un événement de vente sans
          // orientation même quand l'arme en a une.
          orientation: weapon.orientation,
          resolvedVehicleType: null,
          resolvedWeaponType: weapon.type,
          resolvedImprovementType: null,
          resolvedAdvantageType: null,
          resolvedSequellaType: null,
        };
      }
      case EquipmentEntityType.IMPROVEMENT: {
        const improvement = this.assertSellable(
          participant.team.findVehicle(cmd.targetVehicleId!).improvements.find((i) => i.id === cmd.targetEntityId),
          cmd.targetEntityId!,
          'Amélioration',
          'Les améliorations intégrées au profil de base ne peuvent pas être revendues.',
        );
        return {
          refund: improvement.resaleRefund,
          nomInterne: improvement.type.nomInterne,
          orientation: improvement.orientation,
          resolvedVehicleType: null,
          resolvedWeaponType: null,
          resolvedImprovementType: improvement.type,
          resolvedAdvantageType: null,
          resolvedSequellaType: null,
        };
      }
      case EquipmentEntityType.ADVANTAGE: {
        const advantage = participant.team
          .findVehicle(cmd.targetVehicleId!)
          .advantages.find((a) => a.id === cmd.targetEntityId);
        if (!advantage) throw new DomainException(`Avantage ${cmd.targetEntityId} introuvable.`);
        return {
          refund: advantage.resaleRefund,
          nomInterne: advantage.type.nomInterne,
          orientation: null,
          resolvedVehicleType: null,
          resolvedWeaponType: null,
          resolvedImprovementType: null,
          resolvedAdvantageType: advantage.type,
          resolvedSequellaType: null,
        };
      }
      case EquipmentEntityType.SEQUELLE: {
        const vehicle = participant.team.findVehicle(cmd.targetVehicleId!);
        const sequella = vehicle.sequellas.find((s) => s.id === cmd.targetEntityId);
        if (!sequella) throw new DomainException(`Séquelle ${cmd.targetEntityId} introuvable.`);
        // Revente fermée par défaut (contrairement aux 4 autres types) — cf. Vehicle.canRemoveSequella.
        const canRemove = vehicle.canRemoveSequella();
        if (!canRemove.ok) throw new DomainException(canRemove.reason);
        return {
          refund: sequella.resaleRefund,
          nomInterne: sequella.type.nomInterne,
          orientation: null,
          resolvedVehicleType: null,
          resolvedWeaponType: null,
          resolvedImprovementType: null,
          resolvedAdvantageType: null,
          resolvedSequellaType: sequella.type,
        };
      }
    }
  }

  /**
   * Garde commune WEAPON/IMPROVEMENT lors d'une revente : entité introuvable, ou
   * intégrée au profil de base (`estDefaut`) — vérifiée ici pour éviter un événement
   * « poison » au replay (les mutateurs de `Vehicle` revérifient en défense à
   * l'exécution). ADVANTAGE n'a pas d'`estDefaut`, VEHICLE une localisation différente
   * (cf. `resolveSell`) — hors périmètre de ce helper.
   */
  private assertSellable<T extends { estDefaut: boolean }>(
    entity: T | undefined,
    entityId: number,
    label: string,
    estDefautMessage: string,
  ): T {
    if (!entity) throw new DomainException(`${label} ${entityId} introuvable.`);
    if (entity.estDefaut) throw new DomainException(estDefautMessage);
    return entity;
  }
}
