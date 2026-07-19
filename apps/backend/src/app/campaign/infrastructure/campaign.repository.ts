import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
import { CampaignOrm } from './entities/campaign.entity';
import { GameOrm } from './entities/game.entity';
import { GameEventOrm } from './entities/game-event.entity';
import { CampaignParticipantOrm } from './entities/campaign-participant.entity';
import { CampaignMapper } from './campaign.mapper';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import type { Campaign } from '../domain/campaign';
import type { GameEvent } from '../domain/events/game-event';
import type { ITeamRepository } from '../../team/domain/team.repository.interface';
import { TEAM_REPOSITORY } from '../../team/team.tokens';
import { CampaignState, ParticipantStatus } from '../domain/enums/campaign.enums';
import { GameType } from '../game.enums';
import { GameStatus as OrmGameStatus } from '../game.enums';
import { GameStatus as DomainGameStatus } from '../domain/enums/game-status.enum';
import { WalletReason } from '../domain/enums/wallet-reason.enum';
import { WreckResult } from '../domain/enums/wreck-result.enum';
import type { RankingAssignedEvent } from '../domain/events/ranking-assigned.event';
import type { WalletMovementEvent } from '../domain/events/wallet-movement.event';
import type { VehicleLostEvent } from '../domain/events/vehicle-lost.event';
import type { WeaponLostEvent } from '../domain/events/weapon-lost.event';
import type { ImprovementLostEvent } from '../domain/events/improvement-lost.event';
import type { AdvantageLostEvent } from '../domain/events/advantage-lost.event';
import type { WreckResolvedEvent } from '../domain/events/wreck-resolved.event';
import type { EquipmentChangedEvent } from '../domain/events/equipment-changed.event';
import type { GatesCrossedEvent } from '../domain/events/gates-crossed.event';
import type { VehicleDestroyedEvent } from '../domain/events/vehicle-destroyed.event';
import type { FavoriDuPublicBonusEvent } from '../domain/events/favori-du-public-bonus.event';
import type { VehicleRenamedEvent } from '../domain/events/vehicle-renamed.event';
import { GameEventType } from '../domain/enums/game-event-type.enum';

/**
 * Persistence du journal de campagne.
 *
 * Implémente `ICampaignRepository`. La table `game_events` est append-only :
 * `appendEvents` est la seule écriture normale. `saveCampaign` est réservé aux
 * transitions structurelles (finalisation de partie, ouverture/clôture d'atelier).
 */
@Injectable()
export class CampaignRepository implements ICampaignRepository {
  constructor(
    @InjectRepository(CampaignOrm)
    private readonly campaignOrmRepo: Repository<CampaignOrm>,
    @InjectRepository(GameOrm)
    private readonly gameOrmRepo: Repository<GameOrm>,
    @InjectRepository(GameEventOrm)
    private readonly gameEventRepo: Repository<GameEventOrm>,
    @InjectRepository(CampaignParticipantOrm)
    private readonly participantRepo: Repository<CampaignParticipantOrm>,
    @Inject(TEAM_REPOSITORY)
    private readonly teamRepo: ITeamRepository,
    private readonly mapper: CampaignMapper,
  ) {}

  /**
   * Charge et assemble l'agrégat `Campaign` complet depuis la base.
   *
   * Étapes :
   * 1. Participants VALIDATED de la saison
   * 2. Équipes (Team agrégats domaine) via `findManyByIds`
   * 3. Parties ordonnées
   * 4. Événements de toutes les parties
   * 5. Assembly via le mapper
   */
  async findCampaign(campaignId: number): Promise<Campaign> {
    const campaignOrm = await this.campaignOrmRepo.findOne({ where: { id: campaignId } });
    if (!campaignOrm) throw new NotFoundException('Campagne introuvable.');

    // Tous les participants (pas seulement VALIDATED) : l'agrégat unifié porte l'état
    // stocké complet (status/isOrganizer/teamId) pour les commandes CRUD. Le replay et
    // le classement ne considèrent que les VALIDATED avec équipe (cf. Campaign.standings).
    const participantOrms = await this.participantRepo.find({
      where: { campaignId },
      order: { id: 'ASC' },
    });

    const teamIds = participantOrms
      .map((p) => p.teamId)
      .filter((id): id is number => id !== null);
    const teams = teamIds.length > 0 ? await this.teamRepo.findManyByIds(teamIds) : [];

    const gameOrms = await this.gameOrmRepo.find({
      where: { campaignId },
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

    return this.mapper.toCampaign(campaignOrm, participantOrms, teams, gameOrms, eventsByGameId);
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

  /** Cf. `ICampaignRepository.deleteEvent` — annulation d'achat de la session en cours. */
  async deleteEvent(eventId: number): Promise<void> {
    await this.gameEventRepo.delete(eventId);
  }

  /**
   * Cf. `ICampaignRepository.deleteEvents` — annulation cascade d'un véhicule acheté
   * cette session. `Repository.delete` accepte un tableau d'ids directement : un seul
   * `DELETE ... WHERE id IN (...)`, intrinsèquement atomique.
   */
  async deleteEvents(eventIds: number[]): Promise<void> {
    if (eventIds.length === 0) return;
    await this.gameEventRepo.delete(eventIds);
  }

  /**
   * Persiste les transitions structurelles de statut des parties
   * (PLANIFIE→ATELIER→JOUE), déclenchées par EnterAtelier/CloseAtelier/CloseCampaign.
   */
  async saveCampaign(campaign: Campaign): Promise<void> {
    for (const game of campaign.games) {
      const ormStatus = game.status as unknown as OrmGameStatus;
      await this.gameOrmRepo.update(game.id, {
        status: ormStatus,
        ...(game.playedAt ? { playedAt: game.playedAt } : {}),
      });
    }
  }

  // ── Persistance CRUD (Phase 2) ────────────────────────────────────────────────

  async createCampaign(
    name: string,
    inviteCode: string,
    organizerUserId: number,
    teamId: number | null,
  ): Promise<number> {
    const campaign = this.campaignOrmRepo.create({
      name,
      state: CampaignState.EN_CONSTRUCTION,
      inviteCode,
    });
    const saved = await this.campaignOrmRepo.save(campaign);

    const organizer = this.participantRepo.create({
      campaignId: saved.id,
      userId: organizerUserId,
      teamId,
      status: ParticipantStatus.VALIDATED,
      isOrganizer: true,
    });
    await this.participantRepo.save(organizer);
    return saved.id;
  }

  async saveStructural(campaign: Campaign): Promise<void> {
    // 1. Campagne : name/state (inviteCode immuable, non mis à jour).
    await this.campaignOrmRepo.update(campaign.id, {
      name: campaign.name,
      state: campaign.state as unknown as CampaignState,
    });

    // 2. Participants retirés.
    if (campaign.removedParticipantIds.length > 0) {
      await this.participantRepo.delete([...campaign.removedParticipantIds]);
    }

    // 3. Participants : upsert. id<=0 → INSERT (id rétro-alimenté), id>0 → UPDATE.
    for (const p of campaign.participants) {
      if (p.id > 0) {
        await this.participantRepo.update(p.id, {
          status: p.status,
          isOrganizer: p.isOrganizer,
          teamId: p.teamId,
        });
      } else {
        const orm = this.participantRepo.create({
          campaignId: campaign.id,
          userId: p.userId,
          teamId: p.teamId,
          status: p.status,
          isOrganizer: p.isOrganizer,
        });
        const saved = await this.participantRepo.save(orm);
        (p as unknown as { id: number }).id = saved.id;
      }
    }

    // 4. Parties retirées.
    if (campaign.removedGameIds.length > 0) {
      await this.gameOrmRepo.delete([...campaign.removedGameIds]);
    }

    // 5. Parties : upsert.
    for (const game of campaign.games) {
      const scenarioId = (game as unknown as { scenarioId?: string }).scenarioId ?? null;
      const status = game.status as unknown as OrmGameStatus;
      if (game.id > 0) {
        await this.gameOrmRepo.update(game.id, {
          scenarioId,
          type: game.type as GameType,
          status,
          order: game.order,
          playedAt: game.playedAt,
        });
      } else {
        const orm = this.gameOrmRepo.create({
          campaignId: campaign.id,
          scenarioId,
          type: game.type as GameType,
          status,
          order: game.order,
          playedAt: game.playedAt,
        });
        const saved = await this.gameOrmRepo.save(orm);
        (game as unknown as { id: number }).id = saved.id;
      }
    }
  }

  async deleteCampaign(campaignId: number): Promise<void> {
    await this.campaignOrmRepo.delete(campaignId);
  }

  async isTeamEngaged(teamId: number, excludeCampaignId?: number): Promise<boolean> {
    const where = excludeCampaignId
      ? { teamId, campaignId: Not(excludeCampaignId) }
      : { teamId };
    const existing = await this.participantRepo.findOne({ where });
    return existing !== null;
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

    // Dispatch par discriminant explicite (`GameEvent.eventType`, fixé par chaque
    // sous-classe concrète) — un seul cast par branche, justifié par le discriminant
    // qui vient d'être vérifié, plutôt qu'une cascade de tests structurels sur les
    // propriétés présentes. Pas de `default` : GameEventType est un type fermé interne
    // (jamais une donnée externe), TypeScript impose déjà l'exhaustivité (la fonction a
    // un type de retour explicite — tout chemin manquant est une erreur de compilation).
    switch (event.eventType) {
      case GameEventType.RANKING_ASSIGNED: {
        const e = event as RankingAssignedEvent;
        return { ...base, eventType: GameEventType.RANKING_ASSIGNED, rank: e.rank, championshipPoints: e.championshipPoints };
      }
      case GameEventType.WALLET_MOVEMENT: {
        const e = event as WalletMovementEvent;
        return { ...base, eventType: GameEventType.WALLET_MOVEMENT, amount: e.amount, walletReason: e.reason };
      }
      case GameEventType.VEHICLE_LOST: {
        const e = event as VehicleLostEvent;
        return { ...base, eventType: GameEventType.VEHICLE_LOST, vehicleId: e.vehicleId };
      }
      case GameEventType.WEAPON_LOST: {
        const e = event as WeaponLostEvent;
        return { ...base, eventType: GameEventType.WEAPON_LOST, weaponId: e.weaponId };
      }
      case GameEventType.IMPROVEMENT_LOST: {
        const e = event as ImprovementLostEvent;
        return { ...base, eventType: GameEventType.IMPROVEMENT_LOST, improvementId: e.improvementId };
      }
      case GameEventType.ADVANTAGE_LOST: {
        const e = event as AdvantageLostEvent;
        return { ...base, eventType: GameEventType.ADVANTAGE_LOST, advantageId: e.advantageId };
      }
      case GameEventType.WRECK_RESOLVED: {
        const e = event as WreckResolvedEvent;
        return {
          ...base, eventType: GameEventType.WRECK_RESOLVED,
          vehicleId: e.vehicleId,
          diceRoll: e.diceRoll,
          chocsBefore: e.chocsBefore,
          wreckResult: e.wreckResult,
          chocsGained: e.chocsGained,
        };
      }
      case GameEventType.EQUIPMENT_CHANGED: {
        const e = event as EquipmentChangedEvent;
        return {
          ...base, eventType: GameEventType.EQUIPMENT_CHANGED,
          operation: e.operation,
          entityType: e.entityType,
          nomInterne: e.nomInterne,
          cost: e.cost,
          targetVehicleId: e.targetVehicleId,
          targetEntityId: e.targetEntityId,
          orientation: e.orientation,
          freeAdvantageNomInterne: e.freeAdvantageNomInterne,
        };
      }
      case GameEventType.RESISTANCE_CONTACTED:
        return { ...base, eventType: GameEventType.RESISTANCE_CONTACTED };
      case GameEventType.GATES_CROSSED: {
        const e = event as GatesCrossedEvent;
        return { ...base, eventType: GameEventType.GATES_CROSSED, gatesCrossed: e.gatesCrossed, championshipPoints: e.championshipPoints };
      }
      case GameEventType.VEHICLE_DESTROYED: {
        const e = event as VehicleDestroyedEvent;
        return { ...base, eventType: GameEventType.VEHICLE_DESTROYED, vehicleId: e.vehicleId, weightClass: e.weightClass, championshipPoints: e.championshipPoints };
      }
      case GameEventType.FAVORI_DU_PUBLIC_BONUS: {
        const e = event as FavoriDuPublicBonusEvent;
        return { ...base, eventType: GameEventType.FAVORI_DU_PUBLIC_BONUS, vehicleId: e.vehicleId, championshipPoints: e.championshipPoints };
      }
      case GameEventType.VEHICLE_RENAMED: {
        const e = event as VehicleRenamedEvent;
        return {
          ...base, eventType: GameEventType.VEHICLE_RENAMED,
          vehicleId: e.vehicleId,
          previousVehicleName: e.previousName,
          newVehicleName: e.newName,
        };
      }
    }
  }
}
