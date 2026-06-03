/**
 * TeamController — points d'entrée HTTP pour la gestion des équipes.
 *
 * Ce controller expose une API REST CRUD sur /api/teams.
 * Chaque endpoint est protégé par @UseGuards(JwtAuthGuard) :
 * le token JWT est validé avant d'appeler le handler, et req.user
 * est automatiquement rempli par la JwtStrategy.
 *
 * Architecture REST choisie :
 *   GET    /api/teams       → liste des équipes de l'utilisateur connecté
 *   POST   /api/teams       → créer une nouvelle équipe
 *   PUT    /api/teams/:id   → modifier une équipe existante (remplacement complet)
 *   DELETE /api/teams/:id   → supprimer une équipe
 *
 * Note : on utilise PUT (remplacement) plutôt que PATCH (mise à jour partielle)
 * pour simplifier le frontend. Le service accepte quand même des champs partiels
 * via UpdateTeamDto (tous optionnels).
 */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Request,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TeamService } from './team.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { Team } from './team.entity';

// Type du payload injecté par JwtStrategy dans req.user
// (correspond à ce que retourne jwt.strategy.ts → validate())
interface AuthenticatedRequest {
  user: { id: number; email: string };
}

// @UseGuards au niveau du controller : protège TOUS les endpoints de ce controller
// Plus besoin de le répéter sur chaque méthode
@UseGuards(JwtAuthGuard)
@Controller('teams')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  /**
   * GET /api/teams
   * Retourne toutes les équipes de l'utilisateur connecté.
   * req.user.id provient du token JWT décodé par JwtStrategy.
   */
  @Get()
  // Promise<Team[]> : retourne toutes les équipes de l'utilisateur (tableau possiblement vide).
  getAll(@Request() req: AuthenticatedRequest): Promise<Team[]> {
    return this.teamService.findByUserId(req.user.id);
  }

  /**
   * POST /api/teams
   * Crée une nouvelle équipe pour l'utilisateur connecté.
   * @Body() dto : NestJS parse automatiquement le corps JSON de la requête.
   */
  @Post()
  // Promise<Team> : retourne l'entité persistée avec son id généré par la BDD.
  create(@Request() req: AuthenticatedRequest, @Body() dto: CreateTeamDto): Promise<Team> {
    return this.teamService.create(req.user.id, dto);
  }

  /**
   * PUT /api/teams/:id
   * Met à jour une équipe existante.
   * @Param('id', ParseIntPipe) : convertit le paramètre string ":id" en number.
   * Si la conversion échoue (ex: "/teams/abc"), NestJS retourne 400 Bad Request.
   */
  @Put(':id')
  // Promise<Team> : retourne l'entité mise à jour après sauvegarde.
  update(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdateTeamDto,
  ): Promise<Team> {
    return this.teamService.update(id, req.user.id, dto);
  }

  /**
   * DELETE /api/teams/:id
   * Supprime une équipe.
   * Le service vérifie que l'équipe appartient bien à req.user.id avant de supprimer.
   */
  @Delete(':id')
  // Promise<void> : la suppression ne retourne rien — NestJS envoie 200 avec un corps vide.
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthenticatedRequest,
  ): Promise<void> {
    return this.teamService.remove(id, req.user.id);
  }
}
