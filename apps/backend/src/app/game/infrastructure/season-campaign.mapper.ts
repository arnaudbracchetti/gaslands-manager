import { Injectable } from '@nestjs/common';
import { CatalogService } from '../../catalog/catalog.service';
import type { Game as GameOrm } from '../game.entity';
import type { GameEventOrm } from './entities/game-event.entity';
import type { SeasonParticipant as SeasonParticipantOrm } from '../../season/season-participant.entity';
import type { Team } from '../../team/domain/team';

import { Season } from '../domain/season';
import { SeasonParticipant } from '../domain/season-participant';
import { Game } from '../domain/games/game';
import { EvenementTeleGame } from '../domain/games/evenement-tele-game';
import { EscarmoucheGame } from '../domain/games/escarmouche-game';
import { AtelierGame } from '../domain/games/atelier-game';
import { GameStatus } from '../domain/enums/game-status.enum';

import { GameEvent } from '../domain/events/game-event';
import { RankingAssignedEvent } from '../domain/events/ranking-assigned.event';
import { WalletMovementEvent } from '../domain/events/wallet-movement.event';
import { VehicleLostEvent } from '../domain/events/vehicle-lost.event';
import { WeaponLostEvent } from '../domain/events/weapon-lost.event';
import { WreckResolvedEvent } from '../domain/events/wreck-resolved.event';
import { SequellaAddedEvent } from '../domain/events/sequella-added.event';
import { EquipmentChangedEvent } from '../domain/events/equipment-changed.event';
import type { EquipmentOperation, EquipmentEntityType } from '../domain/events/equipment-changed.event';
import { ResistanceContactedEvent } from '../domain/events/resistance-contacted.event';

import { WalletReason } from '../domain/enums/wallet-reason.enum';
import { WreckResult } from '../domain/enums/wreck-result.enum';
import type { Orientation } from '../../team/domain/team';

import { VehicleType } from '../../team/domain/value-objects/vehicle-type';
import { WeaponType } from '../../team/domain/value-objects/weapon-type';

import { DomainException } from '../../shared/domain/domain-exception';

/**
 * Traduction ORM → domaine pour le module campagne.
 *
 * Ce mapper est la seule classe qui connaît à la fois les entités TypeORM et les
 * objets de domaine. Il dépend de `CatalogService` pour résoudre les Value Objects
 * `VehicleType`/`WeaponType` des `EquipmentChangedEvent`.
 */
@Injectable()
export class SeasonCampaignMapper {
  constructor(private readonly catalog: CatalogService) {}

  /**
   * Assemble l'agrégat domaine `Season` depuis les entités ORM chargées par le
   * repository. Les `Team` agrégats domaine sont passés en paramètre (chargés
   * séparément via `ITeamRepository.findManyByIds`).
   */
  toSeason(
    seasonId: number,
    participantOrms: SeasonParticipantOrm[],
    teams: Team[],
    gameOrms: GameOrm[],
    eventsByGameId: Map<number, GameEventOrm[]>,
  ): Season {
    const teamById = new Map(teams.map((t) => [t.id, t]));

    const participants = participantOrms.map((p) => {
      const domParticipant = new SeasonParticipant(p.id, p.userId, p.teamId ?? 0, p.isOrganizer);
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

    return new Season(seasonId, participants, games);
  }

  // ── Mapping Game ─────────────────────────────────────────────────────────────

  private toGame(orm: GameOrm, events: GameEvent[]): Game {
    const status = orm.status as unknown as GameStatus;
    const playedAt = orm.playedAt;

    switch (orm.type) {
      case 'EVENEMENT_TELE':
        return new EvenementTeleGame(orm.id, orm.seasonId, status, orm.order, orm.scenarioId ?? '', playedAt, events);
      case 'ESCARMOUCHE':
        return new EscarmoucheGame(orm.id, orm.seasonId, status, orm.order, orm.scenarioId ?? '', playedAt, events);
      case 'ATELIER':
        return new AtelierGame(orm.id, orm.seasonId, status, orm.order, events);
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

      case 'SEQUELLA_ADDED':
        return new SequellaAddedEvent(id, gameId, participantId, eventOrder, orm.vehicleId!, orm.sequellaTypeNom!, orm.chocsCost!);

      case 'EQUIPMENT_CHANGED':
        return this.toEquipmentChangedEvent(orm);

      case 'RESISTANCE_CONTACTED':
        return new ResistanceContactedEvent(id, gameId, participantId, eventOrder);

      default:
        throw new DomainException(`Type d'événement inconnu : "${orm.eventType}"`);
    }
  }

  private toEquipmentChangedEvent(orm: GameEventOrm): EquipmentChangedEvent {
    const operation = orm.operation as EquipmentOperation;
    const entityType = orm.entityType as EquipmentEntityType;
    const orientation = orm.orientation as Orientation | null;

    let resolvedVehicleType: VehicleType | null = null;
    let resolvedWeaponType: WeaponType | null = null;

    if (entityType === 'VEHICLE') {
      const raw = this.catalog.getVehiculeByNomInterne(orm.nomInterne!);
      if (!raw) throw new DomainException(`Véhicule catalogue introuvable : "${orm.nomInterne}"`);
      resolvedVehicleType = VehicleType.from(raw);
    } else {
      const raw = this.catalog.getArmeByNomInterne(orm.nomInterne!);
      if (!raw) throw new DomainException(`Arme catalogue introuvable : "${orm.nomInterne}"`);
      resolvedWeaponType = WeaponType.from(raw);
    }

    return new EquipmentChangedEvent(
      orm.id, orm.gameId, orm.participantId, orm.eventOrder,
      operation, entityType, orm.nomInterne!, orm.cost!,
      orm.targetVehicleId, orm.targetEntityId, orientation,
      resolvedVehicleType, resolvedWeaponType,
    );
  }
}
