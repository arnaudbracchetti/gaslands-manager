/**
 * CampaignController — point d'entrée HTTP unique du module campagne.
 *
 * Fusion des anciens CampaignController (CRUD ligue/participants) et GameController
 * (Programme Télé + endpoints event-sourcing). Controller *mince* : chaque route
 * traduit HTTP → commande et délègue à un use case (écritures) ou au
 * CampaignQueryService (lectures). Aucune règle métier ici.
 *
 * On déclare des chemins complets explicites (@Controller() sans préfixe) afin
 * d'héberger la route publique `catalog/scenarios` dans le même controller, et de
 * maîtriser l'ordre des routes. Le guard JWT est posé par route (pas au niveau
 * classe) pour laisser `catalog/scenarios` public.
 */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// Lecture (CQRS)
import { CampaignQueryService } from './campaign-query.service';
import { ScenarioCatalogService } from './scenario-catalog.service';

// Use cases CRUD (Phase 2)
import { CreateCampaignUseCase } from './application/create-campaign.usecase';
import { ChangeStateUseCase } from './application/change-state.usecase';
import { DeleteCampaignUseCase } from './application/delete-campaign.usecase';
import { RequestJoinUseCase } from './application/request-join.usecase';
import { ValidateParticipantUseCase } from './application/validate-participant.usecase';
import { PromoteParticipantUseCase } from './application/promote-participant.usecase';
import { RemoveParticipantUseCase } from './application/remove-participant.usecase';
import { ChangeMyTeamUseCase } from './application/change-my-team.usecase';
import { AddGameUseCase } from './application/add-game.usecase';
import { UpdateGameUseCase } from './application/update-game.usecase';
import { RemoveGameUseCase } from './application/remove-game.usecase';
import { RecordResultUseCase } from './application/record-result.usecase';
import { GetParticipantVehiclesUseCase } from './application/get-participant-vehicles.usecase';

// Use cases event-sourcing (Parties 4-5, inchangés)
import { RecordWalletMovementUseCase } from './application/record-wallet-movement.usecase';
import { RecordVehicleLostUseCase } from './application/record-vehicle-lost.usecase';
import { ContactResistanceUseCase } from './application/contact-resistance.usecase';
import { EnterAtelierUseCase } from './application/enter-atelier.usecase';
import { CloseAtelierUseCase } from './application/close-atelier.usecase';
import { GetStandingsUseCase } from './application/get-standings.usecase';
import { ChangeEquipmentUseCase } from './application/change-equipment.usecase';
import { WreckResolveUseCase } from './application/wreck-resolve.usecase';
import { GetWorkshopUseCase } from './application/get-workshop.usecase';
import { GetWorkshopAvailableWeaponsUseCase } from './application/get-workshop-available-weapons.usecase';
import { GetWorkshopAvailableImprovementsUseCase } from './application/get-workshop-available-improvements.usecase';
import { GetWorkshopAvailableAdvantagesUseCase } from './application/get-workshop-available-advantages.usecase';
import { GetWorkshopAvailableSequellesUseCase } from './application/get-workshop-available-sequelles.usecase';

// DTOs
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { CampaignResponseDto } from './dto/campaign-response.dto';
import { CampaignSummaryDto } from './dto/campaign-summary.dto';
import { JoinCampaignDto } from './dto/join-campaign.dto';
import { ValidateParticipantDto } from './dto/validate-participant.dto';
import { ChangeStateDto } from './dto/change-state.dto';
import { CampaignParticipantResponseDto } from './dto/campaign-participant-response.dto';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { GameResponseDto } from './dto/game-response.dto';
import type { GameResultResponseDto } from './dto/game-result-response.dto';
import type { GameJournalEntryDto } from './dto/game-journal-response.dto';
import type { RecordResultDto } from './dto/record-result.dto';
import type { RecordWalletDto } from './dto/record-wallet.dto';
import type { RecordVehicleLostDto } from './dto/record-vehicle-lost.dto';
import type { ContactResistanceDto } from './dto/contact-resistance.dto';
import type { ChangeEquipmentDto } from './dto/change-equipment.dto';
import type { WreckResolveDto } from './dto/wreck-resolve.dto';
import type { StandingsResponseDto } from './dto/standings-response.dto';
import type { WorkshopStateDto } from './dto/workshop-state.dto';
import type { AvailableWeaponDto } from '../team/dto/available-weapon.dto';
import type { AvailableImprovementDto } from '../team/dto/available-improvement.dto';
import type { AvailableAdvantageDto } from '../team/dto/available-advantage.dto';
import type { AvailableSequellaDto } from '../team/dto/available-sequella.dto';
import type { ParticipantVehiclesDto } from './dto/participant-vehicles-response.dto';
import type { Scenario } from './scenario.interfaces';
import type { EnterAtelierResult } from './application/enter-atelier.usecase';
import type { WreckResolveResult } from './application/wreck-resolve.usecase';

// Payload injecté par JwtStrategy dans req.user.
interface AuthenticatedRequest {
  user: { id: number; email: string };
}

@Controller()
export class CampaignController {
  constructor(
    private readonly query: CampaignQueryService,
    private readonly scenarioCatalog: ScenarioCatalogService,
    // CRUD
    private readonly createCampaignUseCase: CreateCampaignUseCase,
    private readonly changeStateUseCase: ChangeStateUseCase,
    private readonly deleteCampaignUseCase: DeleteCampaignUseCase,
    private readonly requestJoinUseCase: RequestJoinUseCase,
    private readonly validateParticipantUseCase: ValidateParticipantUseCase,
    private readonly promoteParticipantUseCase: PromoteParticipantUseCase,
    private readonly removeParticipantUseCase: RemoveParticipantUseCase,
    private readonly changeMyTeamUseCase: ChangeMyTeamUseCase,
    private readonly addGameUseCase: AddGameUseCase,
    private readonly updateGameUseCase: UpdateGameUseCase,
    private readonly removeGameUseCase: RemoveGameUseCase,
    private readonly recordResultUseCase: RecordResultUseCase,
    private readonly getParticipantVehiclesUseCase: GetParticipantVehiclesUseCase,
    // Event sourcing
    private readonly recordWalletUseCase: RecordWalletMovementUseCase,
    private readonly recordVehicleLostUseCase: RecordVehicleLostUseCase,
    private readonly contactResistanceUseCase: ContactResistanceUseCase,
    private readonly enterAtelierUseCase: EnterAtelierUseCase,
    private readonly closeAtelierUseCase: CloseAtelierUseCase,
    private readonly getStandingsUseCase: GetStandingsUseCase,
    private readonly changeEquipmentUseCase: ChangeEquipmentUseCase,
    private readonly wreckResolveUseCase: WreckResolveUseCase,
    private readonly getWorkshopUseCase: GetWorkshopUseCase,
    private readonly getWorkshopAvailableWeaponsUseCase: GetWorkshopAvailableWeaponsUseCase,
    private readonly getWorkshopAvailableImprovementsUseCase: GetWorkshopAvailableImprovementsUseCase,
    private readonly getWorkshopAvailableAdvantagesUseCase: GetWorkshopAvailableAdvantagesUseCase,
    private readonly getWorkshopAvailableSequellesUseCase: GetWorkshopAvailableSequellesUseCase,
  ) {}

  // ── Catalogue (public) ──────────────────────────────────────────────────────

  /** GET /api/catalog/scenarios — liste publique des scénarios (pas de JWT). */
  @Get('catalog/scenarios')
  getScenarios(): Scenario[] {
    return this.scenarioCatalog.getAll();
  }

  // ── Campagnes (CRUD + lectures) ─────────────────────────────────────────────

  /** GET /api/campaigns — campagnes de l'utilisateur (tous statuts). */
  @UseGuards(JwtAuthGuard)
  @Get('campaigns')
  getAll(@Request() req: AuthenticatedRequest): Promise<CampaignResponseDto[]> {
    return this.query.findAll(req.user.id);
  }

  /** POST /api/campaigns — crée une campagne (l'utilisateur devient organisateur). */
  @UseGuards(JwtAuthGuard)
  @Post('campaigns')
  async create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateCampaignDto,
  ): Promise<CampaignResponseDto> {
    const id = await this.createCampaignUseCase.execute({
      userId: req.user.id,
      name: dto.name,
      teamId: dto.teamId ?? null,
    });
    return this.query.findOne(id, req.user.id);
  }

  /** GET /api/campaigns/by-code/:code — infos minimales via code d'invitation. */
  @UseGuards(JwtAuthGuard)
  @Get('campaigns/by-code/:code')
  getByCode(@Param('code') code: string): Promise<CampaignSummaryDto> {
    return this.query.findByInviteCode(code);
  }

  /** GET /api/campaigns/pending — mes demandes d'inscription en attente. */
  @UseGuards(JwtAuthGuard)
  @Get('campaigns/pending')
  getPending(@Request() req: AuthenticatedRequest): Promise<CampaignResponseDto[]> {
    return this.query.findPendingForUser(req.user.id);
  }

  /** GET /api/campaigns/organizing/pending-requests — mes campagnes avec demandes à traiter. */
  @UseGuards(JwtAuthGuard)
  @Get('campaigns/organizing/pending-requests')
  getOrganizingPendingRequests(@Request() req: AuthenticatedRequest): Promise<CampaignResponseDto[]> {
    return this.query.findOrganizedWithPendingRequests(req.user.id);
  }

  /**
   * GET /api/campaigns/:id/games/:gameId/participant-vehicles — véhicules
   * courants (hors perdus) des participants indiqués (organisateur), pour le
   * picker "véhicules ennemis détruits" de la saisie d'exploits (US-B2).
   */
  @UseGuards(JwtAuthGuard)
  @Get('campaigns/:id/games/:gameId/participant-vehicles')
  getParticipantVehicles(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) campaignId: number,
    @Param('gameId', ParseIntPipe) gameId: number,
    @Query('participantIds') participantIds: string,
  ): Promise<ParticipantVehiclesDto[]> {
    const ids = (participantIds ?? '')
      .split(',')
      .map((s) => Number(s))
      .filter((n) => Number.isInteger(n));
    return this.getParticipantVehiclesUseCase.execute({
      campaignId,
      gameId,
      userId: req.user.id,
      participantIds: ids,
    });
  }

  // ── Programme Télé & résultats ──────────────────────────────────────────────

  /** GET /api/campaigns/:id/standings — classement (participant VALIDATED). */
  @UseGuards(JwtAuthGuard)
  @Get('campaigns/:id/standings')
  getStandings(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) campaignId: number,
  ): Promise<StandingsResponseDto[]> {
    return this.getStandingsUseCase.execute({ campaignId, userId: req.user.id });
  }

  /** GET /api/campaigns/:id/workshop — état atelier du participant connecté. */
  @UseGuards(JwtAuthGuard)
  @Get('campaigns/:id/workshop')
  getWorkshop(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) campaignId: number,
  ): Promise<WorkshopStateDto> {
    return this.getWorkshopUseCase.execute({ campaignId, userId: req.user.id });
  }

  /**
   * GET /api/campaigns/:id/workshop/vehicles/:vehicleId/available-weapons — verdict de
   * disponibilité des armes du sponsor pour un véhicule d'atelier (R1, budget = cagnotte).
   */
  @UseGuards(JwtAuthGuard)
  @Get('campaigns/:id/workshop/vehicles/:vehicleId/available-weapons')
  getWorkshopAvailableWeapons(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) campaignId: number,
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
  ): Promise<AvailableWeaponDto[]> {
    return this.getWorkshopAvailableWeaponsUseCase.execute({ campaignId, vehicleId, userId: req.user.id });
  }

  /**
   * GET /api/campaigns/:id/workshop/vehicles/:vehicleId/available-improvements — verdict de
   * disponibilité des améliorations (budget = cagnotte).
   */
  @UseGuards(JwtAuthGuard)
  @Get('campaigns/:id/workshop/vehicles/:vehicleId/available-improvements')
  getWorkshopAvailableImprovements(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) campaignId: number,
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
  ): Promise<AvailableImprovementDto[]> {
    return this.getWorkshopAvailableImprovementsUseCase.execute({ campaignId, vehicleId, userId: req.user.id });
  }

  /**
   * GET /api/campaigns/:id/workshop/vehicles/:vehicleId/available-advantages — verdict de
   * disponibilité des avantages (budget = cagnotte), y compris Cascadeur/Sur Deux Roues.
   */
  @UseGuards(JwtAuthGuard)
  @Get('campaigns/:id/workshop/vehicles/:vehicleId/available-advantages')
  getWorkshopAvailableAdvantages(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) campaignId: number,
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
  ): Promise<AvailableAdvantageDto[]> {
    return this.getWorkshopAvailableAdvantagesUseCase.execute({ campaignId, vehicleId, userId: req.user.id });
  }

  /**
   * GET /api/campaigns/:id/workshop/vehicles/:vehicleId/available-sequelles — verdict de
   * disponibilité des séquelles ATELIER (monnaie Chocs, pas la cagnotte) pour un véhicule
   * d'atelier. Les séquelles TABLE_EPAVES sont exclues (jamais achetables directement).
   */
  @UseGuards(JwtAuthGuard)
  @Get('campaigns/:id/workshop/vehicles/:vehicleId/available-sequelles')
  getWorkshopAvailableSequelles(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) campaignId: number,
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
  ): Promise<AvailableSequellaDto[]> {
    return this.getWorkshopAvailableSequellesUseCase.execute({ campaignId, vehicleId, userId: req.user.id });
  }

  /** GET /api/campaigns/:id/games/:gameId/results — résultats triés (dérivés du journal). */
  @UseGuards(JwtAuthGuard)
  @Get('campaigns/:id/games/:gameId/results')
  getResults(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('gameId', ParseIntPipe) gameId: number,
  ): Promise<GameResultResponseDto[]> {
    return this.query.getResults(id, gameId, req.user.id);
  }

  /** GET /api/campaigns/:id/games/:gameId/journal — journal complet, tout participant VALIDATED. */
  @UseGuards(JwtAuthGuard)
  @Get('campaigns/:id/games/:gameId/journal')
  getJournal(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('gameId', ParseIntPipe) gameId: number,
  ): Promise<GameJournalEntryDto[]> {
    return this.query.getJournal(id, gameId, req.user.id);
  }

  /** POST /api/campaigns/:id/games/:gameId/results — enregistre le résultat (PLANIFIE → JOUE). */
  @UseGuards(JwtAuthGuard)
  @Post('campaigns/:id/games/:gameId/results')
  async recordResult(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('gameId', ParseIntPipe) gameId: number,
    @Body() dto: RecordResultDto,
  ): Promise<GameResponseDto> {
    await this.recordResultUseCase.execute({
      campaignId: id,
      gameId,
      userId: req.user.id,
      results: dto.results,
    });
    return this.query.getGame(id, gameId);
  }

  /** GET /api/campaigns/:id/games — programme trié (participant VALIDATED). */
  @UseGuards(JwtAuthGuard)
  @Get('campaigns/:id/games')
  getGames(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<GameResponseDto[]> {
    return this.query.findGames(id, req.user.id);
  }

  /** POST /api/campaigns/:id/games — ajoute une partie (organisateur). */
  @UseGuards(JwtAuthGuard)
  @Post('campaigns/:id/games')
  async createGame(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateGameDto,
  ): Promise<GameResponseDto> {
    const gameId = await this.addGameUseCase.execute({
      campaignId: id,
      userId: req.user.id,
      scenarioId: dto.scenarioId,
      type: dto.type,
    });
    return this.query.getGame(id, gameId);
  }

  /** PUT /api/campaigns/:id/games/:gameId — édite une partie PLANIFIE (organisateur). */
  @UseGuards(JwtAuthGuard)
  @Put('campaigns/:id/games/:gameId')
  async updateGame(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('gameId', ParseIntPipe) gameId: number,
    @Body() dto: UpdateGameDto,
  ): Promise<GameResponseDto> {
    await this.updateGameUseCase.execute({
      campaignId: id,
      gameId,
      userId: req.user.id,
      scenarioId: dto.scenarioId,
      type: dto.type,
    });
    return this.query.getGame(id, gameId);
  }

  /** DELETE /api/campaigns/:id/games/:gameId — supprime une partie PLANIFIE (organisateur). */
  @UseGuards(JwtAuthGuard)
  @Delete('campaigns/:id/games/:gameId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeGame(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('gameId', ParseIntPipe) gameId: number,
  ): Promise<void> {
    return this.removeGameUseCase.execute({ campaignId: id, gameId, userId: req.user.id });
  }

  /** POST /api/campaigns/:id/games/:gameId/enter-atelier — PLANIFIE → ATELIER (résultat enregistré). */
  @UseGuards(JwtAuthGuard)
  @Post('campaigns/:id/games/:gameId/enter-atelier')
  enterAtelier(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) campaignId: number,
    @Param('gameId', ParseIntPipe) gameId: number,
  ): Promise<EnterAtelierResult> {
    return this.enterAtelierUseCase.execute({ campaignId, gameId, userId: req.user.id });
  }

  /** POST /api/campaigns/:id/games/:gameId/close-atelier — clôture manuelle (ATELIER → JOUE). */
  @UseGuards(JwtAuthGuard)
  @Post('campaigns/:id/games/:gameId/close-atelier')
  @HttpCode(HttpStatus.NO_CONTENT)
  closeAtelier(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) campaignId: number,
    @Param('gameId', ParseIntPipe) gameId: number,
  ): Promise<void> {
    return this.closeAtelierUseCase.execute({ campaignId, gameId, userId: req.user.id });
  }

  // ── Événements de partie (event sourcing) ───────────────────────────────────

  /** POST /api/campaigns/:id/games/:gameId/events/wallet — mouvement de cagnotte (organisateur). */
  @UseGuards(JwtAuthGuard)
  @Post('campaigns/:id/games/:gameId/events/wallet')
  @HttpCode(HttpStatus.NO_CONTENT)
  recordWallet(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) campaignId: number,
    @Param('gameId', ParseIntPipe) gameId: number,
    @Body() dto: RecordWalletDto,
  ): Promise<void> {
    return this.recordWalletUseCase.execute({
      campaignId,
      gameId,
      userId: req.user.id,
      participantId: dto.participantId,
      amount: dto.amount,
      reason: dto.reason,
    });
  }

  /** POST /api/campaigns/:id/games/:gameId/events/vehicle-lost — perte de véhicule (organisateur). */
  @UseGuards(JwtAuthGuard)
  @Post('campaigns/:id/games/:gameId/events/vehicle-lost')
  @HttpCode(HttpStatus.NO_CONTENT)
  recordVehicleLost(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) campaignId: number,
    @Param('gameId', ParseIntPipe) gameId: number,
    @Body() dto: RecordVehicleLostDto,
  ): Promise<void> {
    return this.recordVehicleLostUseCase.execute({
      campaignId,
      gameId,
      userId: req.user.id,
      participantId: dto.participantId,
      vehicleId: dto.vehicleId,
      weaponIds: dto.weaponIds,
    });
  }

  /** POST /api/campaigns/:id/games/:gameId/events/resistance — contact Résistance (organisateur). */
  @UseGuards(JwtAuthGuard)
  @Post('campaigns/:id/games/:gameId/events/resistance')
  @HttpCode(HttpStatus.NO_CONTENT)
  contactResistance(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) campaignId: number,
    @Param('gameId', ParseIntPipe) gameId: number,
    @Body() dto: ContactResistanceDto,
  ): Promise<void> {
    return this.contactResistanceUseCase.execute({
      campaignId,
      gameId,
      userId: req.user.id,
      participantId: dto.participantId,
    });
  }

  /** POST /api/campaigns/:id/events/equipment — achat/revente atelier (partie en cours en ATELIER). */
  @UseGuards(JwtAuthGuard)
  @Post('campaigns/:id/events/equipment')
  @HttpCode(HttpStatus.NO_CONTENT)
  changeEquipment(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) campaignId: number,
    @Body() dto: ChangeEquipmentDto,
  ): Promise<void> {
    return this.changeEquipmentUseCase.execute({
      campaignId,
      userId: req.user.id,
      operation: dto.operation,
      entityType: dto.entityType,
      nomInterne: dto.nomInterne,
      targetVehicleId: dto.targetVehicleId,
      targetEntityId: dto.targetEntityId,
      orientation: dto.orientation,
      freeAdvantageNomInterne: dto.freeAdvantageNomInterne,
    });
  }

  /** POST /api/campaigns/:id/games/:gameId/events/wreck — Table des Épaves (D6 serveur, organisateur). */
  @UseGuards(JwtAuthGuard)
  @Post('campaigns/:id/games/:gameId/events/wreck')
  resolveWreck(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) campaignId: number,
    @Param('gameId', ParseIntPipe) gameId: number,
    @Body() dto: WreckResolveDto,
  ): Promise<WreckResolveResult> {
    return this.wreckResolveUseCase.execute({
      campaignId,
      gameId,
      userId: req.user.id,
      participantId: dto.participantId,
      vehicleId: dto.vehicleId,
      pendingFavoriDuPublic: dto.pendingFavoriDuPublic,
    });
  }

  // ── Participants ────────────────────────────────────────────────────────────

  /** POST /api/campaigns/:id/participants — demande d'inscription (PENDING). */
  @UseGuards(JwtAuthGuard)
  @Post('campaigns/:id/participants')
  async requestJoin(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: JoinCampaignDto,
  ): Promise<CampaignParticipantResponseDto> {
    const pid = await this.requestJoinUseCase.execute({
      campaignId: id,
      userId: req.user.id,
      teamId: dto.teamId,
    });
    return this.query.getParticipant(id, pid);
  }

  /** GET /api/campaigns/:id/participants — liste des participants (participant VALIDATED). */
  @UseGuards(JwtAuthGuard)
  @Get('campaigns/:id/participants')
  getParticipants(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CampaignParticipantResponseDto[]> {
    return this.query.findParticipants(id, req.user.id);
  }

  /** PUT /api/campaigns/:id/state — transition d'état (organisateur). */
  @UseGuards(JwtAuthGuard)
  @Put('campaigns/:id/state')
  async changeState(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeStateDto,
  ): Promise<CampaignResponseDto> {
    await this.changeStateUseCase.execute({ campaignId: id, userId: req.user.id, state: dto.state });
    return this.query.findOne(id, req.user.id);
  }

  /**
   * PUT /api/campaigns/:id/participants/me — change l'équipe engagée par l'utilisateur.
   * Déclarée avant ':pid/...' pour éviter que NestJS ne capture 'me' comme :pid.
   */
  @UseGuards(JwtAuthGuard)
  @Put('campaigns/:id/participants/me')
  async updateMyTeam(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: JoinCampaignDto,
  ): Promise<CampaignParticipantResponseDto> {
    const pid = await this.changeMyTeamUseCase.execute({
      campaignId: id,
      userId: req.user.id,
      teamId: dto.teamId ?? null,
    });
    return this.query.getParticipant(id, pid);
  }

  /** PUT /api/campaigns/:id/participants/:pid/promote — promotion co-organisateur (organisateur). */
  @UseGuards(JwtAuthGuard)
  @Put('campaigns/:id/participants/:pid/promote')
  async promoteParticipant(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('pid', ParseIntPipe) pid: number,
  ): Promise<CampaignParticipantResponseDto> {
    await this.promoteParticipantUseCase.execute({ campaignId: id, pid, userId: req.user.id });
    return this.query.getParticipant(id, pid);
  }

  /** PUT /api/campaigns/:id/participants/:pid/validate — valider/refuser (organisateur). */
  @UseGuards(JwtAuthGuard)
  @Put('campaigns/:id/participants/:pid/validate')
  async validateParticipant(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('pid', ParseIntPipe) pid: number,
    @Body() dto: ValidateParticipantDto,
  ): Promise<CampaignParticipantResponseDto> {
    await this.validateParticipantUseCase.execute({
      campaignId: id,
      pid,
      userId: req.user.id,
      accept: dto.accept,
    });
    return this.query.getParticipant(id, pid);
  }

  /** DELETE /api/campaigns/:id/participants/:pid — retrait définitif (organisateur, EN_CONSTRUCTION). */
  @UseGuards(JwtAuthGuard)
  @Delete('campaigns/:id/participants/:pid')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeParticipant(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('pid', ParseIntPipe) pid: number,
  ): Promise<void> {
    return this.removeParticipantUseCase.execute({ campaignId: id, pid, userId: req.user.id });
  }

  // ── Détail / suppression campagne (routes :id génériques en dernier) ─────────

  /** GET /api/campaigns/:id — détail (participant VALIDATED). */
  @UseGuards(JwtAuthGuard)
  @Get('campaigns/:id')
  getOne(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CampaignResponseDto> {
    return this.query.findOne(id, req.user.id);
  }

  /** DELETE /api/campaigns/:id — suppression (organisateur, cascade). */
  @UseGuards(JwtAuthGuard)
  @Delete('campaigns/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.deleteCampaignUseCase.execute({ campaignId: id, userId: req.user.id });
  }
}
