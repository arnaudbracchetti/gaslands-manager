/**
 * GameController — points d'entrée HTTP du Programme Télé (mode campagne).
 *
 * Deux familles de routes :
 *   - /api/seasons/:id/games[...] : CRUD des parties d'une saison (JWT requis).
 *   - /api/catalog/scenarios       : liste publique des scénarios (pas de JWT).
 *
 * On déclare des chemins complets explicites (@Controller() sans préfixe) plutôt
 * que de réutiliser @Controller('seasons') : cela évite toute interférence avec
 * l'ordre des routes du SeasonController existant, et permet d'exposer la route
 * catalogue publique dans le même contrôleur. Le guard JWT est posé par route,
 * pas au niveau classe, pour laisser /catalog/scenarios public.
 */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GameService } from './game.service';
import { ScenarioCatalogService } from './scenario-catalog.service';
import { GameResultService } from './game-result.service';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { GameResponseDto } from './dto/game-response.dto';
import type { Scenario } from './scenario.interfaces';
import type { RecordResultDto } from './dto/record-result.dto';
import type { GameResultResponseDto } from './dto/game-result-response.dto';

// Payload injecté par JwtStrategy dans req.user (même forme que season.controller.ts).
interface AuthenticatedRequest {
  user: { id: number; email: string };
}

@Controller()
export class GameController {
  constructor(
    private readonly gameService: GameService,
    private readonly scenarioCatalog: ScenarioCatalogService,
    private readonly gameResultService: GameResultService,
  ) {}

  /**
   * GET /api/catalog/scenarios
   * Liste publique des scénarios du catalogue (pour le formulaire d'ajout de partie).
   * Pas de guard : donnée de référence, comme le reste du catalogue.
   */
  @Get('catalog/scenarios')
  getScenarios(): Scenario[] {
    return this.scenarioCatalog.getAll();
  }

  /**
   * GET /api/seasons/:id/games
   * Programme de la saison, trié — accessible à tout participant VALIDATED.
   */
  @UseGuards(JwtAuthGuard)
  @Get('seasons/:id/games')
  getGames(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<GameResponseDto[]> {
    return this.gameService.findAllForSeason(id, req.user.id);
  }

  /**
   * POST /api/seasons/:id/games
   * Ajoute une partie au Programme (organisateur, saison EN_COURS).
   */
  @UseGuards(JwtAuthGuard)
  @Post('seasons/:id/games')
  createGame(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateGameDto,
  ): Promise<GameResponseDto> {
    return this.gameService.create(id, req.user.id, dto);
  }

  /**
   * PUT /api/seasons/:id/games/:gameId
   * Modifie une partie PLANIFIE (organisateur, saison EN_COURS).
   */
  @UseGuards(JwtAuthGuard)
  @Put('seasons/:id/games/:gameId')
  updateGame(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('gameId', ParseIntPipe) gameId: number,
    @Body() dto: UpdateGameDto,
  ): Promise<GameResponseDto> {
    return this.gameService.update(id, gameId, req.user.id, dto);
  }

  /**
   * DELETE /api/seasons/:id/games/:gameId
   * Supprime une partie PLANIFIE (organisateur, saison EN_COURS).
   */
  @UseGuards(JwtAuthGuard)
  @Delete('seasons/:id/games/:gameId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeGame(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('gameId', ParseIntPipe) gameId: number,
  ): Promise<void> {
    return this.gameService.remove(id, gameId, req.user.id);
  }

  /**
   * POST /api/seasons/:id/games/:gameId/results
   * Enregistre le résultat d'une partie (organisateur, partie PLANIFIE).
   * Passe la partie en JOUE et calcule les Points de Championnat.
   */
  @UseGuards(JwtAuthGuard)
  @Post('seasons/:id/games/:gameId/results')
  recordResult(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('gameId', ParseIntPipe) gameId: number,
    @Body() dto: RecordResultDto,
  ): Promise<GameResponseDto> {
    return this.gameResultService.recordResult(id, gameId, req.user.id, dto);
  }

  /**
   * GET /api/seasons/:id/games/:gameId/results
   * Retourne les résultats d'une partie triés par rang (participant VALIDATED).
   */
  @UseGuards(JwtAuthGuard)
  @Get('seasons/:id/games/:gameId/results')
  getResults(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('gameId', ParseIntPipe) gameId: number,
  ): Promise<GameResultResponseDto[]> {
    return this.gameResultService.getResults(id, gameId, req.user.id);
  }
}
