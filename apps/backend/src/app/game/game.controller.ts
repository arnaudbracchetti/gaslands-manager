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
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GameService } from './game.service';
import { ScenarioCatalogService } from './scenario-catalog.service';
import { GameResultService } from './game-result.service';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { GameResponseDto } from './dto/game-response.dto';
import type { RecordRankingDto } from './dto/record-ranking.dto';
import type { RecordWalletDto } from './dto/record-wallet.dto';
import type { RecordVehicleLostDto } from './dto/record-vehicle-lost.dto';
import type { ContactResistanceDto } from './dto/contact-resistance.dto';
import type { StandingsResponseDto } from './dto/standings-response.dto';
import type { Scenario } from './scenario.interfaces';
import type { RecordResultDto } from './dto/record-result.dto';
import type { GameResultResponseDto } from './dto/game-result-response.dto';
import type { FinalizeGameResult } from './application/finalize-game.usecase';

// Use cases campagne Partie 4
import { RecordRankingUseCase } from './application/record-ranking.usecase';
import { RecordWalletMovementUseCase } from './application/record-wallet-movement.usecase';
import { RecordVehicleLostUseCase } from './application/record-vehicle-lost.usecase';
import { ContactResistanceUseCase } from './application/contact-resistance.usecase';
import { FinalizeGameUseCase } from './application/finalize-game.usecase';
import { GetStandingsUseCase } from './application/get-standings.usecase';

// Use cases campagne Partie 5
import { ChangeEquipmentUseCase } from './application/change-equipment.usecase';
import { WreckResolveUseCase } from './application/wreck-resolve.usecase';
import { AddSequellaUseCase } from './application/add-sequella.usecase';
import { CampaignReplayService } from './infrastructure/campaign-replay.service';
import type { ChangeEquipmentDto } from './dto/change-equipment.dto';
import type { WreckResolveDto } from './dto/wreck-resolve.dto';
import type { AddSequellaDto } from './dto/add-sequella.dto';
import type { WorkshopStateDto, WorkshopVehicleDto } from './dto/workshop-state.dto';
import type { WreckResolveResult } from './application/wreck-resolve.usecase';
import type { SeasonParticipant } from './domain/season-participant';

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
    private readonly recordRankingUseCase: RecordRankingUseCase,
    private readonly recordWalletUseCase: RecordWalletMovementUseCase,
    private readonly recordVehicleLostUseCase: RecordVehicleLostUseCase,
    private readonly contactResistanceUseCase: ContactResistanceUseCase,
    private readonly finalizeGameUseCase: FinalizeGameUseCase,
    private readonly changeEquipmentUseCase: ChangeEquipmentUseCase,
    private readonly wreckResolveUseCase: WreckResolveUseCase,
    private readonly addSequellaUseCase: AddSequellaUseCase,
    private readonly replayService: CampaignReplayService,
    private readonly getStandingsUseCase: GetStandingsUseCase,
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

  // ── Endpoints campagne (Partie 4) ─────────────────────────────────────────────

  /**
   * POST /api/seasons/:id/games/:gameId/events/ranking
   * B1-B2 — Enregistre le rang et les PC d'un participant après une partie.
   * Organisateur uniquement.
   */
  @UseGuards(JwtAuthGuard)
  @Post('seasons/:id/games/:gameId/events/ranking')
  @HttpCode(HttpStatus.NO_CONTENT)
  recordRanking(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) seasonId: number,
    @Param('gameId', ParseIntPipe) gameId: number,
    @Body() dto: RecordRankingDto,
  ): Promise<void> {
    return this.recordRankingUseCase.execute({
      seasonId,
      gameId,
      userId: req.user.id,
      participantId: dto.participantId,
      rank: dto.rank,
      championshipPoints: dto.championshipPoints,
    });
  }

  /**
   * POST /api/seasons/:id/games/:gameId/events/wallet
   * B3 — Enregistre un mouvement de cagnotte (gain ou dépense).
   * Organisateur uniquement.
   */
  @UseGuards(JwtAuthGuard)
  @Post('seasons/:id/games/:gameId/events/wallet')
  @HttpCode(HttpStatus.NO_CONTENT)
  recordWallet(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) seasonId: number,
    @Param('gameId', ParseIntPipe) gameId: number,
    @Body() dto: RecordWalletDto,
  ): Promise<void> {
    return this.recordWalletUseCase.execute({
      seasonId,
      gameId,
      userId: req.user.id,
      participantId: dto.participantId,
      amount: dto.amount,
      reason: dto.reason,
    });
  }

  /**
   * POST /api/seasons/:id/games/:gameId/events/vehicle-lost
   * Enregistre la perte d'un véhicule (et optionnellement de ses armes).
   * Organisateur uniquement.
   */
  @UseGuards(JwtAuthGuard)
  @Post('seasons/:id/games/:gameId/events/vehicle-lost')
  @HttpCode(HttpStatus.NO_CONTENT)
  recordVehicleLost(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) seasonId: number,
    @Param('gameId', ParseIntPipe) gameId: number,
    @Body() dto: RecordVehicleLostDto,
  ): Promise<void> {
    return this.recordVehicleLostUseCase.execute({
      seasonId,
      gameId,
      userId: req.user.id,
      participantId: dto.participantId,
      vehicleId: dto.vehicleId,
      weaponIds: dto.weaponIds,
    });
  }

  /**
   * POST /api/seasons/:id/games/:gameId/events/resistance
   * F1 — Enregistre le contact de la Résistance (+3 PR secrets).
   * Organisateur uniquement.
   */
  @UseGuards(JwtAuthGuard)
  @Post('seasons/:id/games/:gameId/events/resistance')
  @HttpCode(HttpStatus.NO_CONTENT)
  contactResistance(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) seasonId: number,
    @Param('gameId', ParseIntPipe) gameId: number,
    @Body() dto: ContactResistanceDto,
  ): Promise<void> {
    return this.contactResistanceUseCase.execute({
      seasonId,
      gameId,
      userId: req.user.id,
      participantId: dto.participantId,
    });
  }

  /**
   * POST /api/seasons/:id/games/:gameId/finalize
   * Finalise une partie PLANIFIE → JOUE ; crée un AtelierGame OUVERT intercalaire.
   * Organisateur uniquement.
   */
  @UseGuards(JwtAuthGuard)
  @Post('seasons/:id/games/:gameId/finalize')
  finalizeGame(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) seasonId: number,
    @Param('gameId', ParseIntPipe) gameId: number,
  ): Promise<FinalizeGameResult> {
    return this.finalizeGameUseCase.execute({ seasonId, gameId, userId: req.user.id });
  }

  /**
   * GET /api/seasons/:id/standings
   * C1 — Classement de la campagne après replay complet.
   * Accessible à tout participant VALIDATED.
   */
  @UseGuards(JwtAuthGuard)
  @Get('seasons/:id/standings')
  getStandings(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) seasonId: number,
  ): Promise<StandingsResponseDto[]> {
    return this.getStandingsUseCase.execute({ seasonId, userId: req.user.id });
  }

  // ── Endpoints campagne (Partie 5) ─────────────────────────────────────────────

  /**
   * GET /api/seasons/:id/workshop
   * État campagne de l'équipe du participant connecté après replay complet.
   * Inclut les entités transientes (achats atelier) et les effets accumulés.
   */
  @UseGuards(JwtAuthGuard)
  @Get('seasons/:id/workshop')
  async getWorkshop(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) seasonId: number,
  ): Promise<WorkshopStateDto> {
    const season = await this.replayService.loadAndReplay(seasonId);
    const me = season.participants.find((p: SeasonParticipant) => p.userId === req.user.id) as SeasonParticipant | undefined;
    if (!me) throw new NotFoundException('Saison introuvable ou accès non autorisé.');
    const vehicles: WorkshopVehicleDto[] = me.team.vehicles.map((v) => ({
      id: v.id,
      nomInterne: v.type.nomInterne,
      price: v.type.price,
      isLost: v.isLost,
      chocs: v.chocs,
      sequellas: v.sequellas.map((s) => ({
        nomInterne: s.nomInterne,
        nom: s.nom,
        chocsCost: s.chocsCost,
      })),
      weapons: v.weapons.map((w) => ({
        id: w.id,
        nomInterne: w.type.nomInterne,
        orientation: w.orientation,
        price: w.type.price,
        isLost: w.isLost,
      })),
    }));
    return { participantId: me.id, wallet: me.wallet, championshipPoints: me.championshipPoints, vehicles };
  }

  /**
   * POST /api/seasons/:id/games/:gameId/events/equipment
   * D1-D3 — Achat ou revente d'équipement en atelier (AtelierGame OUVERT).
   * Participant propriétaire de l'équipe uniquement.
   */
  @UseGuards(JwtAuthGuard)
  @Post('seasons/:id/games/:gameId/events/equipment')
  @HttpCode(HttpStatus.NO_CONTENT)
  changeEquipment(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) seasonId: number,
    @Param('gameId', ParseIntPipe) gameId: number,
    @Body() dto: ChangeEquipmentDto,
  ): Promise<void> {
    return this.changeEquipmentUseCase.execute({
      seasonId,
      gameId,
      userId: req.user.id,
      operation: dto.operation,
      entityType: dto.entityType,
      nomInterne: dto.nomInterne,
      targetVehicleId: dto.targetVehicleId,
      targetEntityId: dto.targetEntityId,
      orientation: dto.orientation,
    });
  }

  /**
   * POST /api/seasons/:id/games/:gameId/events/wreck
   * E1-E3 — Lance D6 côté serveur et résout la Table des Épaves (D-S9).
   * Organisateur uniquement.
   */
  @UseGuards(JwtAuthGuard)
  @Post('seasons/:id/games/:gameId/events/wreck')
  resolveWreck(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) seasonId: number,
    @Param('gameId', ParseIntPipe) gameId: number,
    @Body() dto: WreckResolveDto,
  ): Promise<WreckResolveResult> {
    return this.wreckResolveUseCase.execute({
      seasonId,
      gameId,
      userId: req.user.id,
      participantId: dto.participantId,
      vehicleId: dto.vehicleId,
      weaponIdChoice: dto.weaponIdChoice,
    });
  }

  /**
   * POST /api/seasons/:id/games/:gameId/events/sequella
   * D4/E4 — Échange des Chocs contre une séquelle permanente (AtelierGame OUVERT).
   * Accessible à tout participant (répare son propre véhicule).
   */
  @UseGuards(JwtAuthGuard)
  @Post('seasons/:id/games/:gameId/events/sequella')
  @HttpCode(HttpStatus.NO_CONTENT)
  addSequella(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) seasonId: number,
    @Param('gameId', ParseIntPipe) gameId: number,
    @Body() dto: AddSequellaDto,
  ): Promise<void> {
    return this.addSequellaUseCase.execute({
      seasonId,
      gameId,
      userId: req.user.id,
      vehicleId: dto.vehicleId,
      sequellaTypeNom: dto.sequellaTypeNom,
    });
  }
}
