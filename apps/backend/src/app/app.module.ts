import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserOrm } from './auth/user.entity';
import { CatalogModule } from './catalog/catalog.module';
import { ContentModule } from './content/content.module';
import { TeamModule } from './team/team.module';
import { TeamOrm } from './team/infrastructure/entities/team.entity';
import {
  VehicleOrm,
  VehicleImprovementOrm,
} from './team/infrastructure/entities/vehicle.entity';
import { WeaponOrm } from './team/infrastructure/entities/weapon.entity';
import { CampaignModule } from './campaign/campaign.module';
import { CampaignOrm } from './campaign/infrastructure/entities/campaign.entity';
import { CampaignParticipantOrm } from './campaign/infrastructure/entities/campaign-participant.entity';
import { GameOrm } from './campaign/infrastructure/entities/game.entity';
import { GameEventOrm } from './campaign/infrastructure/entities/game-event.entity';

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
        entities: [TeamOrm, UserOrm, VehicleOrm, VehicleImprovementOrm, WeaponOrm, CampaignOrm, CampaignParticipantOrm, GameOrm, GameEventOrm],
        synchronize: true,
        logging: false,
      }),
    }),

    ContentModule,
    TeamModule,
    AuthModule,
    CatalogModule,
    CampaignModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
