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
  HttpCode,
  Header,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { User } from '../auth/domain/user';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import type { TeamSummaryDto } from './domain/team.repository.interface';
import { GetTeamSummariesUseCase } from './application/get-team-summaries.usecase';
import { CreateTeamUseCase } from './application/create-team.usecase';
import { UpdateTeamUseCase } from './application/update-team.usecase';
import { RemoveTeamUseCase } from './application/remove-team.usecase';
import { GetTeamSheetUseCase } from './application/get-team-sheet.usecase';

/** `req.user` est l'agrégat `User` déposé par `JwtStrategy.validate()`. */
interface AuthenticatedRequest {
  user: User;
}

@UseGuards(JwtAuthGuard)
@Controller('teams')
export class TeamController {
  constructor(
    private readonly getTeamSummaries: GetTeamSummariesUseCase,
    private readonly createTeamUseCase: CreateTeamUseCase,
    private readonly updateTeamUseCase: UpdateTeamUseCase,
    private readonly removeTeamUseCase: RemoveTeamUseCase,
    private readonly getTeamSheetUseCase: GetTeamSheetUseCase,
  ) {}

  @Get()
  getAll(@Request() req: AuthenticatedRequest): Promise<TeamSummaryDto[]> {
    return this.getTeamSummaries.execute({ userId: req.user.id });
  }

  @Post()
  create(@Request() req: AuthenticatedRequest, @Body() dto: CreateTeamDto): Promise<TeamSummaryDto> {
    return this.createTeamUseCase.execute({
      userId: req.user.id,
      name: dto.name,
      sponsor: dto.sponsor,
      cans: dto.cans,
      description: dto.description,
    });
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdateTeamDto,
  ): Promise<TeamSummaryDto> {
    return this.updateTeamUseCase.execute({
      teamId: id,
      userId: req.user.id,
      name: dto.name,
      sponsor: dto.sponsor,
      cans: dto.cans,
      description: dto.description,
    });
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number, @Request() req: AuthenticatedRequest): Promise<void> {
    return this.removeTeamUseCase.execute({ teamId: id, userId: req.user.id });
  }

  @Get(':id/sheet')
  @Header('Content-Type', 'text/html; charset=utf-8')
  getSheet(@Param('id', ParseIntPipe) id: number, @Request() req: AuthenticatedRequest): Promise<string> {
    return this.getTeamSheetUseCase.execute({
      teamId: id,
      userId: req.user.id,
      playerName: req.user.callName,
    });
  }
}
