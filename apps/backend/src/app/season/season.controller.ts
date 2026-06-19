/**
 * SeasonController — points d'entrée HTTP pour la gestion des saisons.
 *
 * Architecture REST (US1 uniquement) :
 *   GET  /api/seasons → liste des saisons de l'utilisateur connecté
 *   POST /api/seasons → créer une nouvelle saison
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
import { SeasonService } from './season.service';
import { SeasonParticipantService } from './season-participant.service';
import { CreateSeasonDto } from './dto/create-season.dto';
import { SeasonResponseDto } from './dto/season-response.dto';
import { SeasonSummaryDto } from './dto/season-summary.dto';
import { JoinSeasonDto } from './dto/join-season.dto';
import { ValidateParticipantDto } from './dto/validate-participant.dto';
import { ChangeStateDto } from './dto/change-state.dto';
import { SeasonParticipantResponseDto } from './dto/season-participant-response.dto';
import { SeasonParticipant } from './season-participant.entity';

// Type du payload injecté par JwtStrategy dans req.user (même forme que team.controller.ts)
interface AuthenticatedRequest {
  user: { id: number; email: string };
}

@UseGuards(JwtAuthGuard)
@Controller('seasons')
export class SeasonController {
  constructor(
    private readonly seasonService: SeasonService,
    private readonly seasonParticipantService: SeasonParticipantService,
  ) {}

  /**
   * GET /api/seasons
   * Retourne toutes les saisons où l'utilisateur connecté a un SeasonParticipant.
   */
  @Get()
  getAll(@Request() req: AuthenticatedRequest): Promise<SeasonResponseDto[]> {
    return this.seasonService.findAll(req.user.id);
  }

  /**
   * POST /api/seasons
   * Crée une nouvelle saison ; l'équipe choisie doit appartenir à l'utilisateur connecté.
   */
  @Post()
  create(@Request() req: AuthenticatedRequest, @Body() dto: CreateSeasonDto): Promise<SeasonResponseDto> {
    return this.seasonService.create(req.user.id, dto);
  }

  /**
   * GET /api/seasons/by-code/:code
   * Retourne les informations minimales d'une saison à partir de son code
   * d'invitation — accessible à tout utilisateur connecté.
   */
  @Get('by-code/:code')
  getByCode(@Param('code') code: string): Promise<SeasonSummaryDto> {
    return this.seasonService.findByInviteCode(code);
  }

  /**
   * GET /api/seasons/pending
   * Retourne les saisons où l'utilisateur connecté a une demande
   * d'inscription en attente de validation.
   *
   * Déclarée avant @Get(':id') pour que 'pending' ne soit pas capturé par
   * le paramètre :id.
   */
  @Get('pending')
  getPending(@Request() req: AuthenticatedRequest): Promise<SeasonResponseDto[]> {
    return this.seasonService.findPendingForUser(req.user.id);
  }

  /**
   * GET /api/seasons/organizing/pending-requests
   * Retourne les saisons organisées par l'utilisateur connecté ayant au
   * moins une demande d'inscription en attente, avec leur nombre.
   *
   * Déclarée avant @Get(':id') pour que 'organizing' ne soit pas capturé par
   * le paramètre :id.
   */
  @Get('organizing/pending-requests')
  getOrganizingPendingRequests(@Request() req: AuthenticatedRequest): Promise<SeasonResponseDto[]> {
    return this.seasonService.findOrganizedWithPendingRequests(req.user.id);
  }

  /**
   * POST /api/seasons/:id/participants
   * Crée une demande d'inscription (status: PENDING) pour l'utilisateur connecté,
   * avec l'équipe choisie.
   */
  @Post(':id/participants')
  requestJoin(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: JoinSeasonDto,
  ): Promise<SeasonParticipant> {
    return this.seasonService.requestJoin(id, req.user.id, dto);
  }

  /**
   * GET /api/seasons/:id/participants
   * Liste tous les participants (tous statuts) de la saison — accessible
   * uniquement à un participant VALIDATED.
   */
  @Get(':id/participants')
  getParticipants(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<SeasonParticipantResponseDto[]> {
    return this.seasonParticipantService.findParticipants(id, req.user.id);
  }

  /**
   * PUT /api/seasons/:id/state
   * Change l'état de la saison — organisateur uniquement. Transitions bidirectionnelles.
   */
  @Put(':id/state')
  changeState(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeStateDto,
  ): Promise<SeasonResponseDto> {
    return this.seasonService.changeState(id, req.user.id, dto.state);
  }

  /**
   * PUT /api/seasons/:id/participants/me
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
    @Body() dto: JoinSeasonDto,
  ): Promise<SeasonParticipantResponseDto> {
    return this.seasonParticipantService.updateMyTeam(id, req.user.id, dto.teamId ?? null);
  }

  /**
   * PUT /api/seasons/:id/participants/:pid/promote
   * Promeut un participant VALIDATED en co-organisateur — organisateur uniquement.
   *
   * Déclaré avant ':pid/validate' pour éviter toute ambiguïté de routage NestJS.
   */
  @Put(':id/participants/:pid/promote')
  promoteParticipant(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('pid', ParseIntPipe) pid: number,
  ): Promise<SeasonParticipantResponseDto> {
    return this.seasonParticipantService.promote(id, pid, req.user.id);
  }

  /**
   * PUT /api/seasons/:id/participants/:pid/validate
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
  ): Promise<SeasonParticipantResponseDto> {
    return this.seasonParticipantService.validate(id, pid, req.user.id, dto.accept);
  }

  /**
   * DELETE /api/seasons/:id/participants/:pid
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
    return this.seasonParticipantService.remove(id, pid, req.user.id);
  }

  /**
   * GET /api/seasons/:id
   * Détail d'une saison — accessible uniquement à un participant VALIDATED.
   *
   * Déclarée APRÈS 'by-code/:code' et les routes ':id/...' pour ne pas
   * capturer ces segments littéraux dans le paramètre :id.
   */
  @Get(':id')
  getOne(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<SeasonResponseDto> {
    return this.seasonService.findOne(id, req.user.id);
  }

  /**
   * DELETE /api/seasons/:id
   * Supprime définitivement une saison — organisateur uniquement.
   * Cascade : tous les SeasonParticipant de la saison sont supprimés
   * (onDelete: 'CASCADE'). Les équipes des participants ne sont pas affectées.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.seasonService.remove(id, req.user.id);
  }
}
