/**
 * CampaignController — points d'entrée HTTP pour la gestion des saisons.
 *
 * Architecture REST (US1 uniquement) :
 *   GET  /api/campaigns → liste des saisons de l'utilisateur connecté
 *   POST /api/campaigns → créer une nouvelle saison
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
import { CampaignService } from './campaign.service';
import { CampaignParticipantService } from './campaign-participant.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { CampaignResponseDto } from './dto/campaign-response.dto';
import { CampaignSummaryDto } from './dto/campaign-summary.dto';
import { JoinCampaignDto } from './dto/join-campaign.dto';
import { ValidateParticipantDto } from './dto/validate-participant.dto';
import { ChangeStateDto } from './dto/change-state.dto';
import { CampaignParticipantResponseDto } from './dto/campaign-participant-response.dto';
import { CampaignParticipant } from './campaign-participant.entity';

// Type du payload injecté par JwtStrategy dans req.user (même forme que team.controller.ts)
interface AuthenticatedRequest {
  user: { id: number; email: string };
}

@UseGuards(JwtAuthGuard)
@Controller('campaigns')
export class CampaignController {
  constructor(
    private readonly campaignService: CampaignService,
    private readonly campaignParticipantService: CampaignParticipantService,
  ) {}

  /**
   * GET /api/campaigns
   * Retourne toutes les saisons où l'utilisateur connecté a un CampaignParticipant.
   */
  @Get()
  getAll(@Request() req: AuthenticatedRequest): Promise<CampaignResponseDto[]> {
    return this.campaignService.findAll(req.user.id);
  }

  /**
   * POST /api/campaigns
   * Crée une nouvelle saison ; l'équipe choisie doit appartenir à l'utilisateur connecté.
   */
  @Post()
  create(@Request() req: AuthenticatedRequest, @Body() dto: CreateCampaignDto): Promise<CampaignResponseDto> {
    return this.campaignService.create(req.user.id, dto);
  }

  /**
   * GET /api/campaigns/by-code/:code
   * Retourne les informations minimales d'une saison à partir de son code
   * d'invitation — accessible à tout utilisateur connecté.
   */
  @Get('by-code/:code')
  getByCode(@Param('code') code: string): Promise<CampaignSummaryDto> {
    return this.campaignService.findByInviteCode(code);
  }

  /**
   * GET /api/campaigns/pending
   * Retourne les saisons où l'utilisateur connecté a une demande
   * d'inscription en attente de validation.
   *
   * Déclarée avant @Get(':id') pour que 'pending' ne soit pas capturé par
   * le paramètre :id.
   */
  @Get('pending')
  getPending(@Request() req: AuthenticatedRequest): Promise<CampaignResponseDto[]> {
    return this.campaignService.findPendingForUser(req.user.id);
  }

  /**
   * GET /api/campaigns/organizing/pending-requests
   * Retourne les saisons organisées par l'utilisateur connecté ayant au
   * moins une demande d'inscription en attente, avec leur nombre.
   *
   * Déclarée avant @Get(':id') pour que 'organizing' ne soit pas capturé par
   * le paramètre :id.
   */
  @Get('organizing/pending-requests')
  getOrganizingPendingRequests(@Request() req: AuthenticatedRequest): Promise<CampaignResponseDto[]> {
    return this.campaignService.findOrganizedWithPendingRequests(req.user.id);
  }

  /**
   * POST /api/campaigns/:id/participants
   * Crée une demande d'inscription (status: PENDING) pour l'utilisateur connecté,
   * avec l'équipe choisie.
   */
  @Post(':id/participants')
  requestJoin(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: JoinCampaignDto,
  ): Promise<CampaignParticipant> {
    return this.campaignService.requestJoin(id, req.user.id, dto);
  }

  /**
   * GET /api/campaigns/:id/participants
   * Liste tous les participants (tous statuts) de la saison — accessible
   * uniquement à un participant VALIDATED.
   */
  @Get(':id/participants')
  getParticipants(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CampaignParticipantResponseDto[]> {
    return this.campaignParticipantService.findParticipants(id, req.user.id);
  }

  /**
   * PUT /api/campaigns/:id/state
   * Change l'état de la saison — organisateur uniquement. Transitions bidirectionnelles.
   */
  @Put(':id/state')
  changeState(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeStateDto,
  ): Promise<CampaignResponseDto> {
    return this.campaignService.changeState(id, req.user.id, dto.state);
  }

  /**
   * PUT /api/campaigns/:id/participants/me
   * Change l'équipe engagée par l'utilisateur connecté — uniquement tant que
   * la saison est EN_CONSTRUCTION.
   *
   * Déclarée avant ':id/participants/:pid/validate' pour que 'me' ne soit
   * pas capturé par le paramètre :pid.
   */
  @Put(':id/participants/me')
  updateMyTeam(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: JoinCampaignDto,
  ): Promise<CampaignParticipantResponseDto> {
    return this.campaignParticipantService.updateMyTeam(id, req.user.id, dto.teamId ?? null);
  }

  /**
   * PUT /api/campaigns/:id/participants/:pid/promote
   * Promeut un participant VALIDATED en co-organisateur — organisateur uniquement.
   *
   * Déclaré avant ':pid/validate' pour éviter toute ambiguïté de routage NestJS.
   */
  @Put(':id/participants/:pid/promote')
  promoteParticipant(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('pid', ParseIntPipe) pid: number,
  ): Promise<CampaignParticipantResponseDto> {
    return this.campaignParticipantService.promote(id, pid, req.user.id);
  }

  /**
   * PUT /api/campaigns/:id/participants/:pid/validate
   * Valide ou refuse une demande d'inscription PENDING, repasse un
   * participant REJECTED en VALIDATED, ou refuse un participant déjà
   * VALIDATED — organisateur uniquement.
   */
  @Put(':id/participants/:pid/validate')
  validateParticipant(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('pid', ParseIntPipe) pid: number,
    @Body() dto: ValidateParticipantDto,
  ): Promise<CampaignParticipantResponseDto> {
    return this.campaignParticipantService.validate(id, pid, req.user.id, dto.accept);
  }

  /**
   * DELETE /api/campaigns/:id/participants/:pid
   * Retire un participant (validé ou en attente) — organisateur uniquement,
   * saison EN_CONSTRUCTION uniquement.
   */
  @Delete(':id/participants/:pid')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeParticipant(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('pid', ParseIntPipe) pid: number,
  ): Promise<void> {
    return this.campaignParticipantService.remove(id, pid, req.user.id);
  }

  /**
   * GET /api/campaigns/:id
   * Détail d'une saison — accessible uniquement à un participant VALIDATED.
   *
   * Déclarée APRÈS 'by-code/:code' et les routes ':id/...' pour ne pas
   * capturer ces segments littéraux dans le paramètre :id.
   */
  @Get(':id')
  getOne(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CampaignResponseDto> {
    return this.campaignService.findOne(id, req.user.id);
  }

  /**
   * DELETE /api/campaigns/:id
   * Supprime définitivement une saison — organisateur uniquement.
   * Cascade : tous les CampaignParticipant de la saison sont supprimés
   * (onDelete: 'CASCADE'). Les équipes des participants ne sont pas affectées.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.campaignService.remove(id, req.user.id);
  }
}
