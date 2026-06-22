import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from './game.entity';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { ScenarioCatalogService } from './scenario-catalog.service';
import { SeasonModule } from '../season/season.module';

// SeasonModule importé pour injecter SeasonService (helpers d'autorisation
// assertOrganizer / assertVisibleParticipant) — déjà exporté par SeasonModule.
@Module({
  imports: [TypeOrmModule.forFeature([Game]), SeasonModule],
  controllers: [GameController],
  providers: [GameService, ScenarioCatalogService],
  exports: [ScenarioCatalogService],
})
export class GameModule {}
