/**
 * GameService — logique métier du Programme Télé (mode campagne, Phase 1 / US-A1).
 *
 * Gère les parties planifiées d'une saison : ajout, édition, suppression et
 * consultation. Délègue l'autorisation saison à CampaignService (assertOrganizer /
 * assertVisibleParticipant) pour ne pas dupliquer les requêtes participant.
 *
 * Règles d'état (US-A1) :
 * - Le programme ne se gère qu'EN_COURS (création/édition/suppression).
 * - Une partie JOUE est figée : ni modifiable, ni supprimable.
 * - L'ordre est auto-append (MAX+1) ; le réordonnancement est hors périmètre (US-A4).
 */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameOrm } from './infrastructure/entities/game.entity';
import { GameStatus } from './game.enums';
import { CampaignService } from './campaign.service';
import { CampaignState } from './campaign.enums';
import { ScenarioCatalogService } from './scenario-catalog.service';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { GameResponseDto } from './dto/game-response.dto';

@Injectable()
export class GameService {
  constructor(
    @InjectRepository(GameOrm)
    private gameRepo: Repository<GameOrm>,
    private campaignService: CampaignService,
    private scenarioCatalog: ScenarioCatalogService,
  ) {}

  /**
   * Liste le Programme d'une saison, trié par ordre — accessible à tout
   * participant VALIDATED (lecture seule, organisateur ou non).
   */
  async findAllForCampaign(campaignId: number, userId: number): Promise<GameResponseDto[]> {
    await this.campaignService.assertVisibleParticipant(campaignId, userId);

    const games = await this.gameRepo.find({
      where: { campaignId },
      order: { order: 'ASC' },
    });
    return games.map((game) => this.toDto(game));
  }

  /**
   * Ajoute une partie au Programme — organisateur, saison EN_COURS uniquement.
   * La partie est créée PLANIFIE, en fin de programme (order = MAX+1).
   */
  async create(campaignId: number, userId: number, dto: CreateGameDto): Promise<GameResponseDto> {
    const campaign = await this.campaignService.assertOrganizer(campaignId, userId);
    this.assertCampaignManageable(campaign.state);

    const scenario = this.scenarioCatalog.getByNomInterne(dto.scenarioId);
    if (!scenario) {
      throw new BadRequestException(`Scénario "${dto.scenarioId}" introuvable.`);
    }

    const nextOrder = await this.nextOrder(campaignId);

    const game = this.gameRepo.create({
      campaignId,
      scenarioId: dto.scenarioId,
      // Type explicite si fourni, sinon le type par défaut du scénario.
      type: dto.type ?? scenario.type,
      status: GameStatus.PLANIFIE,
      order: nextOrder,
      playedAt: null,
    });
    const saved = await this.gameRepo.save(game);
    return this.toDto(saved);
  }

  /**
   * Modifie une partie PLANIFIE — organisateur, saison EN_COURS uniquement.
   * Refuse toute modification d'une partie JOUE.
   */
  async update(
    campaignId: number,
    gameId: number,
    userId: number,
    dto: UpdateGameDto,
  ): Promise<GameResponseDto> {
    const campaign = await this.campaignService.assertOrganizer(campaignId, userId);
    this.assertCampaignManageable(campaign.state);

    const game = await this.findGameOrThrow(campaignId, gameId);
    this.assertNotJoue(game);

    if (dto.scenarioId !== undefined) {
      const scenario = this.scenarioCatalog.getByNomInterne(dto.scenarioId);
      if (!scenario) {
        throw new BadRequestException(`Scénario "${dto.scenarioId}" introuvable.`);
      }
      game.scenarioId = dto.scenarioId;
    }
    if (dto.type !== undefined) {
      game.type = dto.type;
    }

    const saved = await this.gameRepo.save(game);
    return this.toDto(saved);
  }

  /**
   * Supprime une partie PLANIFIE — organisateur, saison EN_COURS uniquement.
   * Refuse la suppression d'une partie JOUE (elle garde sa place historique).
   */
  async remove(campaignId: number, gameId: number, userId: number): Promise<void> {
    const campaign = await this.campaignService.assertOrganizer(campaignId, userId);
    this.assertCampaignManageable(campaign.state);

    const game = await this.findGameOrThrow(campaignId, gameId);
    this.assertNotJoue(game);

    await this.gameRepo.delete(game.id);
  }

  // ── Helpers privés ───────────────────────────────────────────────────────────

  /** Calcule le prochain indice d'ordre (auto-append) pour une saison. */
  private async nextOrder(campaignId: number): Promise<number> {
    // count() suffit ici : les parties d'une saison ne sont jamais "trouées"
    // dans US-A1 (suppression possible mais l'ordre n'a pas besoin d'être
    // contigu — il sert uniquement au tri ASC). MAX+1 serait plus robuste si
    // l'unicité de l'ordre devenait une contrainte ; ce n'est pas le cas ici.
    const max = await this.gameRepo
      .createQueryBuilder('game')
      .select('MAX(game.order)', 'max')
      .where('game.campaignId = :campaignId', { campaignId })
      .getRawOne<{ max: number | null }>();
    return (max?.max ?? 0) + 1;
  }

  /** Charge une partie de la saison ou lève NotFoundException. */
  private async findGameOrThrow(campaignId: number, gameId: number): Promise<GameOrm> {
    const game = await this.gameRepo.findOne({ where: { id: gameId, campaignId } });
    if (!game) {
      throw new NotFoundException('Partie introuvable.');
    }
    return game;
  }

  private assertCampaignManageable(state: CampaignState): void {
    // Le programme se gère dès la construction et tant que la saison est en
    // cours. Une saison TERMINEE est archivée : programme en lecture seule.
    if (state !== CampaignState.EN_CONSTRUCTION && state !== CampaignState.EN_COURS) {
      throw new BadRequestException(
        'Le programme ne peut être géré que tant que la saison n\'est pas terminée.',
      );
    }
  }

  private assertNotJoue(game: GameOrm): void {
    if (game.status === GameStatus.JOUE) {
      throw new BadRequestException('Une partie déjà jouée ne peut plus être modifiée.');
    }
  }

  /**
   * Mappe une entité GameOrm vers son DTO de réponse, en résolvant le libellé du
   * scénario depuis le catalogue (champ calculé, jamais persisté).
   */
  private toDto(game: GameOrm): GameResponseDto {
    const scenario = this.scenarioCatalog.getByNomInterne(game.scenarioId);
    return {
      ...game,
      // Fallback défensif : un scénario retiré du YAML ne casse pas l'affichage.
      scenarioName: scenario?.nom ?? game.scenarioId,
    };
  }
}
