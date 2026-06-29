import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Game as GameOrm } from '../game.entity';
import { GameEventOrm } from './entities/game-event.entity';
import { SeasonParticipant as SeasonParticipantOrm } from '../../season/season-participant.entity';
import { SeasonCampaignMapper } from './season-campaign.mapper';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import type { Season } from '../domain/season';
import type { GameEvent } from '../domain/events/game-event';
import type { AtelierGame } from '../domain/games/atelier-game';
import type { ITeamRepository } from '../../team/domain/team.repository.interface';
import { TEAM_REPOSITORY } from '../../team/team.tokens';
import { ParticipantStatus } from '../../season/season.enums';
import { GameType } from '../game.enums';
import { GameStatus as OrmGameStatus } from '../game.enums';
import { GameStatus as DomainGameStatus } from '../domain/enums/game-status.enum';
import { WalletReason } from '../domain/enums/wallet-reason.enum';
import { WreckResult } from '../domain/enums/wreck-result.enum';
import type { RankingAssignedEvent } from '../domain/events/ranking-assigned.event';
import type { WalletMovementEvent } from '../domain/events/wallet-movement.event';
import type { VehicleLostEvent } from '../domain/events/vehicle-lost.event';
import type { WeaponLostEvent } from '../domain/events/weapon-lost.event';
import type { WreckResolvedEvent } from '../domain/events/wreck-resolved.event';
import type { SequellaAddedEvent } from '../domain/events/sequella-added.event';
import type { EquipmentChangedEvent } from '../domain/events/equipment-changed.event';
import type { ResistanceContactedEvent } from '../domain/events/resistance-contacted.event';

/**
 * Persistence du journal de campagne.
 *
 * Implémente `ICampaignRepository`. La table `game_events` est append-only :
 * `appendEvents` est la seule écriture normale. `saveSeason` est réservé aux
 * transitions structurelles (finalisation de partie, ouverture/clôture d'atelier).
 */
@Injectable()
export class SeasonCampaignRepository implements ICampaignRepository {
  constructor(
    @InjectRepository(GameOrm)
    private readonly gameOrmRepo: Repository<GameOrm>,
    @InjectRepository(GameEventOrm)
    private readonly gameEventRepo: Repository<GameEventOrm>,
    @InjectRepository(SeasonParticipantOrm)
    private readonly participantRepo: Repository<SeasonParticipantOrm>,
    @Inject(TEAM_REPOSITORY)
    private readonly teamRepo: ITeamRepository,
    private readonly mapper: SeasonCampaignMapper,
  ) {}

  /**
   * Charge et assemble l'agrégat `Season` complet depuis la base.
   *
   * Étapes :
   * 1. Participants VALIDATED de la saison
   * 2. Équipes (Team agrégats domaine) via `findManyByIds`
   * 3. Parties ordonnées
   * 4. Événements de toutes les parties
   * 5. Assembly via le mapper
   */
  async findCampaign(seasonId: number): Promise<Season> {
    const participantOrms = await this.participantRepo.find({
      where: { seasonId, status: ParticipantStatus.VALIDATED },
      order: { id: 'ASC' },
    });

    const teamIds = participantOrms
      .map((p) => p.teamId)
      .filter((id): id is number => id !== null);
    const teams = teamIds.length > 0 ? await this.teamRepo.findManyByIds(teamIds) : [];

    const gameOrms = await this.gameOrmRepo.find({
      where: { seasonId },
      order: { order: 'ASC' },
    });

    const gameIds = gameOrms.map((g) => g.id);
    const allEvents = gameIds.length > 0
      ? await this.gameEventRepo.find({
          where: { gameId: In(gameIds) },
          order: { eventOrder: 'ASC' },
        })
      : [];

    const eventsByGameId = new Map<number, GameEventOrm[]>();
    for (const event of allEvents) {
      const list = eventsByGameId.get(event.gameId) ?? [];
      list.push(event);
      eventsByGameId.set(event.gameId, list);
    }

    return this.mapper.toSeason(seasonId, participantOrms, teams, gameOrms, eventsByGameId);
  }

  /**
   * Ajoute de nouveaux événements en fin de journal (append-only).
   * Chaque événement est sérialisé vers une ligne `game_events` avec les colonnes
   * appropriées à son type.
   */
  async appendEvents(gameId: number, events: GameEvent[]): Promise<void> {
    const nextOrder = await this.nextEventOrder(gameId);
    const orms = events.map((e, i) => this.eventToOrm(e, nextOrder + i));
    await this.gameEventRepo.save(orms);
  }

  /**
   * Persiste les transitions structurelles : statut des parties (PLANIFIE→JOUE,
   * OUVERT→CLOTURE) et création d'un nouvel AtelierGame.
   */
  async saveSeason(season: Season, newAtelier?: AtelierGame): Promise<void> {
    for (const game of season.games) {
      const ormStatus = game.status as unknown as OrmGameStatus;
      await this.gameOrmRepo.update(game.id, {
        status: ormStatus,
        ...(game.playedAt ? { playedAt: game.playedAt } : {}),
      });
    }

    if (newAtelier) {
      const orm = this.gameOrmRepo.create({
        seasonId: newAtelier.seasonId,
        scenarioId: null,
        type: GameType.ATELIER,
        status: OrmGameStatus.OUVERT,
        order: newAtelier.order,
        playedAt: null,
      });
      const saved = await this.gameOrmRepo.save(orm);
      // Rétro-alimentation de l'id pour les use cases qui persistraient
      // des événements dans ce nouvel atelier dans la même transaction.
      (newAtelier as unknown as { id: number }).id = saved.id;
    }
  }

  // ── Helpers privés ────────────────────────────────────────────────────────────

  private async nextEventOrder(gameId: number): Promise<number> {
    const result = await this.gameEventRepo
      .createQueryBuilder('e')
      .select('MAX(e.eventOrder)', 'max')
      .where('e.gameId = :gameId', { gameId })
      .getRawOne<{ max: number | null }>();
    return (result?.max ?? 0) + 1;
  }

  private eventToOrm(event: GameEvent, eventOrder: number): Partial<GameEventOrm> {
    const base: Partial<GameEventOrm> = {
      gameId: event.gameId,
      participantId: event.participantId,
      eventOrder,
    };

    // Dispatche selon le type concret via duck-typing sur les propriétés de l'événement.
    // On caste d'abord en `unknown` pour accéder aux propriétés spécifiques sans erreur TS.
    const e = event as unknown as Record<string, unknown>;

    if ('rank' in e && 'championshipPoints' in e) {
      return { ...base, eventType: 'RANKING_ASSIGNED', rank: e['rank'] as number, championshipPoints: e['championshipPoints'] as number };
    }
    if ('amount' in e && 'reason' in e) {
      return { ...base, eventType: 'WALLET_MOVEMENT', amount: e['amount'] as number, walletReason: e['reason'] as string };
    }
    if ('vehicleId' in e && !('diceRoll' in e) && !('sequellaTypeNom' in e) && !('operation' in e) && !('weaponId' in e)) {
      return { ...base, eventType: 'VEHICLE_LOST', vehicleId: e['vehicleId'] as number };
    }
    if ('weaponId' in e) {
      return { ...base, eventType: 'WEAPON_LOST', weaponId: e['weaponId'] as number };
    }
    if ('diceRoll' in e) {
      return {
        ...base, eventType: 'WRECK_RESOLVED',
        vehicleId: e['vehicleId'] as number,
        diceRoll: e['diceRoll'] as number,
        chocsBefore: e['chocsBefore'] as number,
        wreckResult: e['wreckResult'] as string,
        chocsGained: e['chocsGained'] as number,
      };
    }
    if ('sequellaTypeNom' in e) {
      return {
        ...base, eventType: 'SEQUELLA_ADDED',
        vehicleId: e['vehicleId'] as number,
        sequellaTypeNom: e['sequellaTypeNom'] as string,
        chocsCost: e['chocsCost'] as number,
      };
    }
    if ('operation' in e) {
      return {
        ...base, eventType: 'EQUIPMENT_CHANGED',
        operation: e['operation'] as string,
        entityType: e['entityType'] as string,
        nomInterne: e['nomInterne'] as string,
        cost: e['cost'] as number,
        targetVehicleId: e['targetVehicleId'] as number | null,
        targetEntityId: e['targetEntityId'] as number | null,
        orientation: e['orientation'] as string | null,
      };
    }
    // ResistanceContactedEvent — pas de payload au-delà des champs de base
    return { ...base, eventType: 'RESISTANCE_CONTACTED' };
  }
}
