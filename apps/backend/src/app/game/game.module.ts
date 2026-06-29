import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from './game.entity';
import { GameResult } from './game-result.entity';
import { GameEventOrm } from './infrastructure/entities/game-event.entity';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { ScenarioCatalogService } from './scenario-catalog.service';
import { GameResultService } from './game-result.service';
import { SeasonModule } from '../season/season.module';
import { SeasonParticipant } from '../season/season-participant.entity';
import { CatalogModule } from '../catalog/catalog.module';
import { TeamModule } from '../team/team.module';

// Infrastructure campagne
import { SeasonCampaignMapper } from './infrastructure/season-campaign.mapper';
import { SeasonCampaignRepository } from './infrastructure/season-campaign.repository';
import { CampaignReplayService } from './infrastructure/campaign-replay.service';
import { WreckResolverService } from './infrastructure/wreck-resolver.service';
import { CAMPAIGN_REPOSITORY } from './game.tokens';
import type { ICampaignRepository } from './domain/campaign.repository.interface';

// Use cases campagne (Partie 4)
import { RecordRankingUseCase } from './application/record-ranking.usecase';
import { RecordWalletMovementUseCase } from './application/record-wallet-movement.usecase';
import { RecordVehicleLostUseCase } from './application/record-vehicle-lost.usecase';
import { ContactResistanceUseCase } from './application/contact-resistance.usecase';
import { FinalizeGameUseCase } from './application/finalize-game.usecase';
import { GetStandingsUseCase } from './application/get-standings.usecase';

// Use cases campagne (Partie 5)
import { ChangeEquipmentUseCase } from './application/change-equipment.usecase';
import { WreckResolveUseCase } from './application/wreck-resolve.usecase';
import { AddSequellaUseCase } from './application/add-sequella.usecase';
import { CatalogService } from '../catalog/catalog.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Game, GameResult, GameEventOrm, SeasonParticipant]),
    SeasonModule,
    CatalogModule,
    TeamModule,
  ],
  controllers: [GameController],
  providers: [
    GameService,
    ScenarioCatalogService,
    GameResultService,

    // Infrastructure campagne
    SeasonCampaignMapper,
    { provide: CAMPAIGN_REPOSITORY, useClass: SeasonCampaignRepository },
    CampaignReplayService,
    WreckResolverService,

    // Use cases campagne — useFactory pour garder les classes sans décorateurs NestJS
    {
      provide: RecordRankingUseCase,
      useFactory: (repo: ICampaignRepository, replay: CampaignReplayService) =>
        new RecordRankingUseCase(repo, replay),
      inject: [CAMPAIGN_REPOSITORY, CampaignReplayService],
    },
    {
      provide: RecordWalletMovementUseCase,
      useFactory: (repo: ICampaignRepository, replay: CampaignReplayService) =>
        new RecordWalletMovementUseCase(repo, replay),
      inject: [CAMPAIGN_REPOSITORY, CampaignReplayService],
    },
    {
      provide: RecordVehicleLostUseCase,
      useFactory: (repo: ICampaignRepository, replay: CampaignReplayService) =>
        new RecordVehicleLostUseCase(repo, replay),
      inject: [CAMPAIGN_REPOSITORY, CampaignReplayService],
    },
    {
      provide: ContactResistanceUseCase,
      useFactory: (repo: ICampaignRepository, replay: CampaignReplayService) =>
        new ContactResistanceUseCase(repo, replay),
      inject: [CAMPAIGN_REPOSITORY, CampaignReplayService],
    },
    {
      provide: FinalizeGameUseCase,
      useFactory: (repo: ICampaignRepository, replay: CampaignReplayService) =>
        new FinalizeGameUseCase(repo, replay),
      inject: [CAMPAIGN_REPOSITORY, CampaignReplayService],
    },
    {
      provide: GetStandingsUseCase,
      useFactory: (repo: ICampaignRepository, replay: CampaignReplayService) =>
        new GetStandingsUseCase(repo, replay),
      inject: [CAMPAIGN_REPOSITORY, CampaignReplayService],
    },

    // Use cases campagne (Partie 5)
    {
      provide: ChangeEquipmentUseCase,
      useFactory: (repo: ICampaignRepository, replay: CampaignReplayService, catalog: CatalogService) =>
        new ChangeEquipmentUseCase(repo, replay, catalog),
      inject: [CAMPAIGN_REPOSITORY, CampaignReplayService, CatalogService],
    },
    {
      provide: WreckResolveUseCase,
      useFactory: (repo: ICampaignRepository, replay: CampaignReplayService, wreck: WreckResolverService) =>
        new WreckResolveUseCase(repo, replay, wreck),
      inject: [CAMPAIGN_REPOSITORY, CampaignReplayService, WreckResolverService],
    },
    {
      provide: AddSequellaUseCase,
      useFactory: (repo: ICampaignRepository, replay: CampaignReplayService) =>
        new AddSequellaUseCase(repo, replay),
      inject: [CAMPAIGN_REPOSITORY, CampaignReplayService],
    },
  ],
  exports: [ScenarioCatalogService, CampaignReplayService, CAMPAIGN_REPOSITORY],
})
export class GameModule {}
