import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { User } from './auth/user.entity';
import { CatalogModule } from './catalog/catalog.module';
import { ContentModule } from './content/content.module';
import { TeamModule } from './team/team.module';
import { Team } from './team/infrastructure/entities/team.entity';
import {
  Vehicle,
  VehicleImprovement,
} from './team/infrastructure/entities/vehicle.entity';
import { Weapon } from './team/infrastructure/entities/weapon.entity';
import { SeasonModule } from './season/season.module';
import { Season } from './season/season.entity';
import { SeasonParticipant } from './season/season-participant.entity';
import { GameModule } from './game/game.module';
import { Game } from './game/game.entity';
import { GameResult } from './game/game-result.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: 'apps/backend/.env',
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DATABASE_HOST', 'localhost'),
        port: config.get<number>('DATABASE_PORT', 5432),
        username: config.get('DATABASE_USER', 'gaslands'),
        password: config.getOrThrow<string>('DATABASE_PASSWORD'),
        database: config.get('DATABASE_NAME', 'gaslands'),
        entities: [Team, User, Vehicle, VehicleImprovement, Weapon, Season, SeasonParticipant, Game, GameResult],
        synchronize: true,
        logging: false,
      }),
    }),

    ContentModule,
    TeamModule,
    AuthModule,
    CatalogModule,
    SeasonModule,
    GameModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
