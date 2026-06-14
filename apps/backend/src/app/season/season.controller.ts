/**
 * SeasonController — points d'entrée HTTP pour la gestion des saisons.
 *
 * Architecture REST (US1 uniquement) :
 *   GET  /api/seasons → liste des saisons de l'utilisateur connecté
 *   POST /api/seasons → créer une nouvelle saison
 */
import { Controller, Get, Post, Body, Param, ParseIntPipe, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SeasonService } from './season.service';
import { CreateSeasonDto } from './dto/create-season.dto';
import { SeasonResponseDto } from './dto/season-response.dto';
import { SeasonSummaryDto } from './dto/season-summary.dto';
import { JoinSeasonDto } from './dto/join-season.dto';
import { SeasonParticipant } from './season-participant.entity';

// Type du payload injecté par JwtStrategy dans req.user (même forme que team.controller.ts)
interface AuthenticatedRequest {
  user: { id: number; email: string };
}

@UseGuards(JwtAuthGuard)
@Controller('seasons')
export class SeasonController {
  constructor(private readonly seasonService: SeasonService) {}

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
}
