import { Injectable } from '@nestjs/common';
import { CatalogService } from '../../catalog/catalog.service';
import type { CampaignOrm } from './entities/campaign.entity';
import type { GameOrm } from './entities/game.entity';
import type { GameEventOrm } from './entities/game-event.entity';
import type { CampaignParticipantOrm } from './entities/campaign-participant.entity';
import type { Team } from '../../team/domain/team';

import { Campaign } from '../domain/campaign';
import { CampaignParticipant } from '../domain/campaign-participant';
import { Game } from '../domain/games/game';
import { EvenementTeleGame } from '../domain/games/evenement-tele-game';
import { EscarmoucheGame } from '../domain/games/escarmouche-game';
import { GameStatus } from '../domain/enums/game-status.enum';

import { GameEvent } from '../domain/events/game-event';
import { RankingAssignedEvent } from '../domain/events/ranking-assigned.event';
import { WalletMovementEvent } from '../domain/events/wallet-movement.event';
import { VehicleLostEvent } from '../domain/events/vehicle-lost.event';
import { WeaponLostEvent } from '../domain/events/weapon-lost.event';
import { WreckResolvedEvent } from '../domain/events/wreck-resolved.event';
import { EquipmentChangedEvent } from '../domain/events/equipment-changed.event';
import { EquipmentOperation, EquipmentEntityType } from '../domain/enums/equipment-change.enums';
import { ResistanceContactedEvent } from '../domain/events/resistance-contacted.event';
import { GatesCrossedEvent } from '../domain/events/gates-crossed.event';
import { VehicleDestroyedEvent } from '../domain/events/vehicle-destroyed.event';

import { WalletReason } from '../domain/enums/wallet-reason.enum';
import { WreckResult } from '../domain/enums/wreck-result.enum';
import { WeightClass } from '../domain/enums/weight-class.enum';
import type { WeaponOrientation } from '../../team/domain/team';

import { VehicleType } from '../../team/domain/value-objects/vehicle-type';
import { WeaponType } from '../../team/domain/value-objects/weapon-type';
import { ImprovementType } from '../../team/domain/value-objects/improvement-type';
import { AdvantageType } from '../../team/domain/value-objects/advantage-type';
import { SequellaType } from '../../team/domain/value-objects/sequella-type';

import { DomainException } from '../../shared/domain/domain-exception';

/**
 * Traduction ORM → domaine pour le module campagne.
 *
 * Ce mapper est la seule classe qui connaît à la fois les entités TypeORM et les
 * objets de domaine. Il dépend de `CatalogService` pour résoudre les Value Objects
 * `VehicleType`/`WeaponType` des `EquipmentChangedEvent`.
 */
@Injectable()
export class CampaignMapper {
  constructor(private readonly catalog: CatalogService) {}

  /**
   * Assemble l'agrégat domaine `Campaign` depuis les entités ORM chargées par le
   * repository. Les `Team` agrégats domaine sont passés en paramètre (chargés
   * séparément via `ITeamRepository.findManyByIds`).
   */
  toCampaign(
    campaignOrm: CampaignOrm,
    participantOrms: CampaignParticipantOrm[],
    teams: Team[],
    gameOrms: GameOrm[],
    eventsByGameId: Map<number, GameEventOrm[]>,
  ): Campaign {
    const teamById = new Map(teams.map((t) => [t.id, t]));

    const participants = participantOrms.map((p) => {
      const domParticipant = new CampaignParticipant(p.id, p.userId, p.teamId, p.isOrganizer, p.status);
      if (p.teamId !== null) {
        const team = teamById.get(p.teamId);
        if (team) domParticipant.attachTeam(team);
      }
      return domParticipant;
    });

    const games = gameOrms.map((g) => {
      const eventOrms = eventsByGameId.get(g.id) ?? [];
      const events = eventOrms.map((e) => this.toEvent(e));
      return this.toGame(g, events);
    });

    return new Campaign(
      campaignOrm.id,
      campaignOrm.name,
      campaignOrm.state,
      campaignOrm.inviteCode,
      participants,
      games,
    );
  }

  // ── Mapping GameOrm ─────────────────────────────────────────────────────────────

  private toGame(orm: GameOrm, events: GameEvent[]): Game {
    const status = orm.status as unknown as GameStatus;
    const playedAt = orm.playedAt;

    switch (orm.type) {
      case 'EVENEMENT_TELE':
        return new EvenementTeleGame(orm.id, orm.campaignId, status, orm.order, orm.scenarioId ?? '', playedAt, events);
      case 'ESCARMOUCHE':
        return new EscarmoucheGame(orm.id, orm.campaignId, status, orm.order, orm.scenarioId ?? '', playedAt, events);
      default:
        throw new DomainException(`Type de partie inconnu : "${orm.type}"`);
    }
  }

  // ── Mapping GameEvent ─────────────────────────────────────────────────────────

  private toEvent(orm: GameEventOrm): GameEvent {
    const { id, gameId, participantId, eventOrder } = orm;

    switch (orm.eventType) {
      case 'RANKING_ASSIGNED':
        return new RankingAssignedEvent(id, gameId, participantId, eventOrder, orm.rank!, orm.championshipPoints!);

      case 'WALLET_MOVEMENT':
        return new WalletMovementEvent(id, gameId, participantId, eventOrder, orm.amount!, orm.walletReason as WalletReason);

      case 'VEHICLE_LOST':
        return new VehicleLostEvent(id, gameId, participantId, eventOrder, orm.vehicleId!);

      case 'WEAPON_LOST':
        return new WeaponLostEvent(id, gameId, participantId, eventOrder, orm.weaponId!);

      case 'WRECK_RESOLVED':
        return new WreckResolvedEvent(
          id, gameId, participantId, eventOrder,
          orm.vehicleId!, orm.diceRoll!, orm.chocsBefore!,
          orm.wreckResult as WreckResult, orm.chocsGained!,
        );

      case 'EQUIPMENT_CHANGED':
        return this.toEquipmentChangedEvent(orm);

      case 'RESISTANCE_CONTACTED':
        return new ResistanceContactedEvent(id, gameId, participantId, eventOrder);

      case 'GATES_CROSSED':
        return new GatesCrossedEvent(id, gameId, participantId, eventOrder, orm.gatesCrossed!, orm.championshipPoints!);

      case 'VEHICLE_DESTROYED':
        return new VehicleDestroyedEvent(
          id, gameId, participantId, eventOrder,
          orm.vehicleId!, orm.weightClass as WeightClass, orm.championshipPoints!,
        );

      default:
        throw new DomainException(`Type d'événement inconnu : "${orm.eventType}"`);
    }
  }

  private toEquipmentChangedEvent(orm: GameEventOrm): EquipmentChangedEvent {
    const operation = orm.operation as EquipmentOperation;
    const entityType = orm.entityType as EquipmentEntityType;
    const orientation = orm.orientation as WeaponOrientation | null;

    // La résolution du Value Object catalogue est OBLIGATOIRE pour un BUY (`execute()`
    // recrée l'entité transiente et en a besoin), mais seulement best-effort pour un SELL :
    // `execute()` d'une revente ne fait que retirer l'entité par son id ; le type ne sert
    // qu'à un éventuel `undo()`. On tolère donc un `nomInterne` vide/inconnu sur un SELL
    // (ex. anciens événements écrits sans `nomInterne`) plutôt que de faire échouer TOUT le
    // replay de la campagne. Les nouveaux SELL portent le `nomInterne` dérivé de l'entité
    // vendue (cf. Campaign.resolveSell).
    const requireResolution = operation === EquipmentOperation.BUY;
    const nomInterne = orm.nomInterne ?? '';

    let resolvedVehicleType: VehicleType | null = null;
    let resolvedWeaponType: WeaponType | null = null;
    let resolvedImprovementType: ImprovementType | null = null;
    let resolvedAdvantageType: AdvantageType | null = null;
    let resolvedSequellaType: SequellaType | null = null;

    switch (entityType) {
      case EquipmentEntityType.VEHICLE: {
        const raw = nomInterne ? this.catalog.getVehiculeByNomInterne(nomInterne) : undefined;
        if (!raw && requireResolution) throw new DomainException(`Véhicule catalogue introuvable : "${nomInterne}"`);
        resolvedVehicleType = raw ? VehicleType.from(raw) : null;
        break;
      }
      case EquipmentEntityType.WEAPON: {
        const raw = nomInterne ? this.catalog.getArmeByNomInterne(nomInterne) : undefined;
        if (!raw && requireResolution) throw new DomainException(`Arme catalogue introuvable : "${nomInterne}"`);
        resolvedWeaponType = raw ? WeaponType.from(raw) : null;
        break;
      }
      case EquipmentEntityType.ADVANTAGE: {
        const raw = nomInterne ? this.catalog.getAvantageByNomInterne(nomInterne) : undefined;
        if (!raw && requireResolution) throw new DomainException(`Avantage catalogue introuvable : "${nomInterne}"`);
        resolvedAdvantageType = raw ? AdvantageType.from(raw) : null;
        break;
      }
      case EquipmentEntityType.IMPROVEMENT: {
        const raw = nomInterne ? this.catalog.getAmeliorationByNomInterne(nomInterne) : undefined;
        if (!raw && requireResolution) throw new DomainException(`Amélioration catalogue introuvable : "${nomInterne}"`);
        resolvedImprovementType = raw ? ImprovementType.from(raw) : null;
        break;
      }
      case EquipmentEntityType.SEQUELLE: {
        const raw = nomInterne ? this.catalog.getSequelleByNomInterne(nomInterne) : undefined;
        if (!raw && requireResolution) throw new DomainException(`Séquelle catalogue introuvable : "${nomInterne}"`);
        resolvedSequellaType = raw ? SequellaType.from(raw) : null;
        break;
      }
    }

    // Avantage gratuit accordé (Dur à Cuire) — best-effort, jamais requis : absent pour
    // toute autre combinaison entityType/nomInterne (cf. EquipmentChangedEvent, doc de classe).
    const freeAdvantageRaw = orm.freeAdvantageNomInterne
      ? this.catalog.getAvantageByNomInterne(orm.freeAdvantageNomInterne)
      : undefined;
    const resolvedFreeAdvantageType = freeAdvantageRaw ? AdvantageType.from(freeAdvantageRaw) : null;

    return new EquipmentChangedEvent(
      orm.id, orm.gameId, orm.participantId, orm.eventOrder,
      operation, entityType, nomInterne, orm.cost!,
      orm.targetVehicleId, orm.targetEntityId, orientation,
      resolvedVehicleType, resolvedWeaponType, resolvedImprovementType, resolvedAdvantageType,
      resolvedSequellaType, resolvedFreeAdvantageType,
    );
  }
}
