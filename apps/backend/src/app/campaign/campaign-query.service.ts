/**
 * CampaignQueryService — côté lecture (CQRS) du module campagne.
 *
 * Regroupe tous les read models autrefois dispersés dans les services anémiques
 * (CampaignService / CampaignParticipantService / GameService / GameResultService).
 * En lecture, l'accès direct à l'ORM est assumé : pas de reconstruction d'agrégat
 * pour de simples projections (COUNT, jointures user/team, tri). Seul `getResults`
 * dérive du journal `game_events` (convergence event-sourcing — la table
 * `game_results` n'existe plus).
 *
 * Toutes les vérifications d'accès lèvent NotFoundException (jamais 403) pour ne
 * pas révéler l'existence d'une campagne à un non-membre.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CampaignOrm } from './infrastructure/entities/campaign.entity';
import { CampaignParticipantOrm } from './infrastructure/entities/campaign-participant.entity';
import { GameOrm } from './infrastructure/entities/game.entity';
import { GameEventOrm } from './infrastructure/entities/game-event.entity';
import { ParticipantStatus } from './domain/enums/campaign.enums';
import { ScenarioCatalogService } from './scenario-catalog.service';
import { CampaignResponseDto } from './dto/campaign-response.dto';
import { CampaignSummaryDto } from './dto/campaign-summary.dto';
import { CampaignParticipantResponseDto } from './dto/campaign-participant-response.dto';
import { GameResponseDto } from './dto/game-response.dto';
import { GameResultResponseDto } from './dto/game-result-response.dto';

@Injectable()
export class CampaignQueryService {
  constructor(
    @InjectRepository(CampaignOrm)
    private readonly campaignRepo: Repository<CampaignOrm>,
    @InjectRepository(CampaignParticipantOrm)
    private readonly participantRepo: Repository<CampaignParticipantOrm>,
    @InjectRepository(GameOrm)
    private readonly gameRepo: Repository<GameOrm>,
    @InjectRepository(GameEventOrm)
    private readonly gameEventRepo: Repository<GameEventOrm>,
    private readonly scenarioCatalog: ScenarioCatalogService,
  ) {}

  // ── Campagnes ─────────────────────────────────────────────────────────────────

  /** Toutes les campagnes où l'utilisateur a une ligne CampaignParticipant (tous statuts). */
  async findAll(userId: number): Promise<CampaignResponseDto[]> {
    const participations = await this.participantRepo.find({
      where: { userId },
      relations: { campaign: true, team: true },
    });

    return Promise.all(
      participations.map(async (p): Promise<CampaignResponseDto> => ({
        ...p.campaign,
        participantCount: await this.participantRepo.count({ where: { campaignId: p.campaignId } }),
        myRole: p.isOrganizer ? 'organizer' : 'participant',
        myTeamName: p.team?.name,
      })),
    );
  }

  /** Campagnes où l'utilisateur a une demande d'inscription PENDING. */
  async findPendingForUser(userId: number): Promise<CampaignResponseDto[]> {
    const participations = await this.participantRepo.find({
      where: { userId, status: ParticipantStatus.PENDING },
      relations: { campaign: true },
    });

    return Promise.all(
      participations.map(async (p): Promise<CampaignResponseDto> => ({
        ...p.campaign,
        participantCount: await this.participantRepo.count({ where: { campaignId: p.campaignId } }),
        myRole: 'participant',
      })),
    );
  }

  /** Campagnes organisées par l'utilisateur ayant au moins une demande PENDING à traiter. */
  async findOrganizedWithPendingRequests(userId: number): Promise<CampaignResponseDto[]> {
    const organized = await this.participantRepo.find({
      where: { userId, isOrganizer: true, status: ParticipantStatus.VALIDATED },
      relations: { campaign: true },
    });

    const enriched = await Promise.all(
      organized.map(async (p) => {
        const [participantCount, pendingRequestsCount] = await Promise.all([
          this.participantRepo.count({ where: { campaignId: p.campaignId } }),
          this.participantRepo.count({
            where: { campaignId: p.campaignId, status: ParticipantStatus.PENDING },
          }),
        ]);
        return {
          ...p.campaign,
          participantCount,
          myRole: 'organizer' as const,
          pendingRequestsCount,
        };
      }),
    );

    return enriched.filter((c) => (c.pendingRequestsCount ?? 0) > 0);
  }

  /** Informations minimales d'une campagne par son code d'invitation (pas de fuite). */
  async findByInviteCode(code: string): Promise<CampaignSummaryDto> {
    const campaign = await this.campaignRepo.findOne({ where: { inviteCode: code } });
    if (!campaign) {
      throw new NotFoundException('Code d\'invitation invalide.');
    }

    const [organizer, participantCount] = await Promise.all([
      this.participantRepo.findOne({
        where: { campaignId: campaign.id, isOrganizer: true },
        relations: { user: true },
      }),
      this.participantRepo.count({
        where: { campaignId: campaign.id, status: ParticipantStatus.VALIDATED },
      }),
    ]);

    return {
      id: campaign.id,
      name: campaign.name,
      state: campaign.state,
      organizerName: organizer ? `${organizer.user.firstName} ${organizer.user.lastName}` : '',
      participantCount,
    };
  }

  /** Détail d'une campagne — participant VALIDATED uniquement. */
  async findOne(id: number, userId: number): Promise<CampaignResponseDto> {
    const participation = await this.participantRepo.findOne({
      where: { campaignId: id, userId, status: ParticipantStatus.VALIDATED },
      relations: { campaign: true },
    });
    if (!participation) {
      throw new NotFoundException('Campagne introuvable.');
    }

    return {
      ...participation.campaign,
      participantCount: await this.participantRepo.count({ where: { campaignId: id } }),
      myRole: participation.isOrganizer ? 'organizer' : 'participant',
    };
  }

  // ── Participants ────────────────────────────────────────────────────────────────

  /** Tous les participants (tous statuts) — participant VALIDATED uniquement. */
  async findParticipants(campaignId: number, userId: number): Promise<CampaignParticipantResponseDto[]> {
    await this.assertVisibleParticipant(campaignId, userId);

    const participants = await this.participantRepo.find({
      where: { campaignId },
      relations: { user: true, team: true },
      order: { id: 'ASC' },
    });
    return participants.map((p) => this.toParticipantDto(p));
  }

  /**
   * Un participant par son id — réponse des commandes participant (validation,
   * promotion, changement d'équipe). L'autorisation a déjà été faite par la commande.
   */
  async getParticipant(campaignId: number, pid: number): Promise<CampaignParticipantResponseDto> {
    const participant = await this.participantRepo.findOne({
      where: { id: pid, campaignId },
      relations: { user: true, team: true },
    });
    if (!participant) {
      throw new NotFoundException('Participant introuvable.');
    }
    return this.toParticipantDto(participant);
  }

  // ── Parties (Programme Télé) ─────────────────────────────────────────────────────

  /** Programme trié d'une campagne — participant VALIDATED uniquement. */
  async findGames(campaignId: number, userId: number): Promise<GameResponseDto[]> {
    await this.assertVisibleParticipant(campaignId, userId);

    const games = await this.gameRepo.find({
      where: { campaignId },
      order: { order: 'ASC' },
    });
    return games.map((g) => this.toGameDto(g));
  }

  /** Une partie par son id — réponse des commandes partie (création/édition/résultat). */
  async getGame(campaignId: number, gameId: number): Promise<GameResponseDto> {
    const game = await this.gameRepo.findOne({ where: { id: gameId, campaignId } });
    if (!game) {
      throw new NotFoundException('Partie introuvable.');
    }
    return this.toGameDto(game);
  }

  /**
   * Résultats d'une partie, triés par rang — dérivés du journal `game_events`.
   * Chaque `RankingAssignedEvent` porte le rang et les PC figés au moment de
   * l'enregistrement — même forme de réponse que l'ancienne table `game_results`.
   */
  async getResults(campaignId: number, gameId: number, userId: number): Promise<GameResultResponseDto[]> {
    await this.assertVisibleParticipant(campaignId, userId);

    const game = await this.gameRepo.findOne({ where: { id: gameId, campaignId } });
    if (!game) {
      throw new NotFoundException('Partie introuvable.');
    }

    const events = await this.gameEventRepo.find({
      where: { gameId, eventType: 'RANKING_ASSIGNED' },
      order: { rank: 'ASC' },
    });

    return events.map((e) => ({
      id: e.id,
      gameId: e.gameId,
      participantId: e.participantId,
      rank: e.rank as number,
      championshipPoints: e.championshipPoints as number,
      createdAt: e.createdAt,
    }));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  /** Vérifie que `userId` est un participant VALIDATED de la campagne. NotFound sinon. */
  private async assertVisibleParticipant(campaignId: number, userId: number): Promise<void> {
    const participation = await this.participantRepo.findOne({
      where: { campaignId, userId, status: ParticipantStatus.VALIDATED },
    });
    if (!participation) {
      throw new NotFoundException('Campagne introuvable.');
    }
  }

  private toParticipantDto(p: CampaignParticipantOrm): CampaignParticipantResponseDto {
    return {
      id: p.id,
      userId: p.userId,
      teamId: p.teamId,
      status: p.status,
      isOrganizer: p.isOrganizer,
      userName: `${p.user.firstName} ${p.user.lastName}`,
      teamName: p.team?.name ?? '',
    };
  }

  private toGameDto(game: GameOrm): GameResponseDto {
    const scenario = game.scenarioId ? this.scenarioCatalog.getByNomInterne(game.scenarioId) : undefined;
    return {
      ...game,
      scenarioName: scenario?.nom ?? game.scenarioId ?? '',
    };
  }
}
