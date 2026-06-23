import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from './game.entity';
import { GameResult } from './game-result.entity';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { ScenarioCatalogService } from './scenario-catalog.service';
import { GameResultService } from './game-result.service';
import { SeasonModule } from '../season/season.module';
import { SeasonParticipant } from '../season/season-participant.entity';

// SeasonModule importé pour injecter SeasonService (helpers d'autorisation
// assertOrganizer / assertVisibleParticipant) — déjà exporté par SeasonModule.
@Module({
  imports: [TypeOrmModule.forFeature([Game, GameResult, SeasonParticipant]), SeasonModule],
  controllers: [GameController],
  providers: [GameService, ScenarioCatalogService, GameResultService],
  exports: [ScenarioCatalogService],
})
export class GameModule {}
