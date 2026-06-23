/**
 * GameResultService — enregistrement des résultats d'une partie (mode campagne).
 *
 * Calcule les Points de Championnat (PC) selon le type de partie :
 * - EVENEMENT_TELE : les ⌈N/2⌉ premiers reçoivent des PC (table : 10/5/2/1/0…).
 * - ESCARMOUCHE    : aucun PC (partie libre, sans enjeu de classement).
 *
 * L'enregistrement est atomique via DataSource.transaction :
 * 1. Insertion des GameResult (un par participant soumis).
 * 2. Mise à jour du statut de la partie (PLANIFIE → JOUE).
 */
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { GameResult } from './game-result.entity';
import { Game } from './game.entity';
import { SeasonParticipant } from '../season/season-participant.entity';
import { SeasonService } from '../season/season.service';
import { ScenarioCatalogService } from './scenario-catalog.service';
import type { RecordResultDto } from './dto/record-result.dto';
import type { GameResultResponseDto } from './dto/game-result-response.dto';
import type { GameResponseDto } from './dto/game-response.dto';
import { GameStatus, GameType } from './game.enums';
import { ParticipantStatus } from '../season/season.enums';

// Points de Championnat attribués par rang (index 0 = rang 1).
// Au-delà de l'index 3 (rang 5+), la valeur est 0.
const POINTS_TABLE = [10, 5, 2, 1];

@Injectable()
export class GameResultService {
  constructor(
    @InjectRepository(Game) private readonly gameRepo: Repository<Game>,
    @InjectRepository(SeasonParticipant) private readonly participantRepo: Repository<SeasonParticipant>,
    @InjectRepository(GameResult) private readonly gameResultRepo: Repository<GameResult>,
    private readonly dataSource: DataSource,
    private readonly seasonService: SeasonService,
    private readonly scenarioCatalog: ScenarioCatalogService,
  ) {}

  /**
   * Enregistre le résultat d'une partie.
   *
   * Contrôles avant persistance :
   * - L'appelant est organisateur de la saison.
   * - La partie existe et appartient à la saison.
   * - La partie est encore PLANIFIE (pas déjà JOUE).
   * - Tous les participantId soumis sont des participants VALIDATED de la saison.
   * - Les rangs sont uniques et consécutifs depuis 1.
   *
   * Retourne le DTO de la partie mise à jour (avec scenarioName résolu).
   */
  async recordResult(
    seasonId: number,
    gameId: number,
    userId: number,
    dto: RecordResultDto,
  ): Promise<GameResponseDto> {
    await this.seasonService.assertOrganizer(seasonId, userId);

    const game = await this.gameRepo.findOne({ where: { id: gameId, seasonId } });
    if (!game) throw new NotFoundException('Partie introuvable');
    if (game.status === GameStatus.JOUE) {
      throw new BadRequestException('Cette partie a déjà été jouée');
    }

    // Charger les participants VALIDATED de la saison pour valider les IDs soumis.
    const validatedParticipants = await this.participantRepo.find({
      where: { seasonId, status: ParticipantStatus.VALIDATED },
    });
    const validIds = new Set(validatedParticipants.map(p => p.id));

    for (const item of dto.results) {
      if (!validIds.has(item.participantId)) {
        throw new BadRequestException(
          `Participant ${item.participantId} inconnu ou non validé dans cette saison`,
        );
      }
    }

    // Valider que les rangs sont uniques et consécutifs à partir de 1.
    const ranks = dto.results.map(r => r.rank).sort((a, b) => a - b);
    const hasDuplicates = new Set(ranks).size !== ranks.length;
    const isConsecutive = ranks.every((r, i) => r === i + 1);
    if (hasDuplicates || !isConsecutive) {
      throw new BadRequestException('Les rangs doivent être uniques et consécutifs à partir de 1');
    }

    // Calcul des Points de Championnat.
    // Pour EVENEMENT_TELE : les ⌈N/2⌉ premiers reçoivent des PC depuis la table.
    // Pour ESCARMOUCHE : tous à 0.
    const n = dto.results.length;
    const classified = Math.ceil(n / 2);

    const results: Partial<GameResult>[] = dto.results.map(item => {
      let championshipPoints = 0;
      if (game.type === GameType.EVENEMENT_TELE && item.rank <= classified) {
        championshipPoints = POINTS_TABLE[item.rank - 1] ?? 0;
      }
      return { gameId, participantId: item.participantId, rank: item.rank, championshipPoints };
    });

    await this.dataSource.transaction(async em => {
      await em.save(GameResult, results);
      await em.save(Game, { id: gameId, status: GameStatus.JOUE, playedAt: new Date() });
    });

    const updatedGame = await this.gameRepo.findOne({ where: { id: gameId } });
    if (!updatedGame) throw new NotFoundException('Partie introuvable après mise à jour');

    const scenario = this.scenarioCatalog.getByNomInterne(updatedGame.scenarioId);
    return { ...updatedGame, scenarioName: scenario?.nom ?? updatedGame.scenarioId };
  }

  /**
   * Retourne les résultats enregistrés pour une partie, triés par rang croissant.
   * Accessible à tout participant VALIDATED de la saison.
   */
  async getResults(
    seasonId: number,
    gameId: number,
    userId: number,
  ): Promise<GameResultResponseDto[]> {
    await this.seasonService.assertVisibleParticipant(seasonId, userId);

    const game = await this.gameRepo.findOne({ where: { id: gameId, seasonId } });
    if (!game) throw new NotFoundException('Partie introuvable');

    return this.gameResultRepo.find({ where: { gameId }, order: { rank: 'ASC' } });
  }
}
