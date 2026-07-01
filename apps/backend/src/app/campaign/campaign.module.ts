import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entités ORM (toutes regroupées dans infrastructure/entities/)
import { CampaignOrm } from './infrastructure/entities/campaign.entity';
import { CampaignParticipantOrm } from './infrastructure/entities/campaign-participant.entity';
import { GameOrm } from './infrastructure/entities/game.entity';
import { GameResultOrm } from './infrastructure/entities/game-result.entity';
import { GameEventOrm } from './infrastructure/entities/game-event.entity';

// Controllers
import { CampaignController } from './campaign.controller';
import { GameController } from './game.controller';

// Services (CRUD anémique + Programme — migrés vers DDD en Phase 2)
import { CampaignService } from './campaign.service';
import { CampaignParticipantService } from './campaign-participant.service';
import { GameService } from './game.service';
import { GameResultService } from './game-result.service';
import { ScenarioCatalogService } from './scenario-catalog.service';

// Modules externes
import { CatalogModule } from '../catalog/catalog.module';
import { CatalogService } from '../catalog/catalog.service';
import { TeamModule } from '../team/team.module';

// Infrastructure campagne (event sourcing)
import { CampaignMapper } from './infrastructure/campaign.mapper';
import { CampaignRepository } from './infrastructure/campaign.repository';
import { CampaignReplayService } from './infrastructure/campaign-replay.service';
import { WreckResolverService } from './infrastructure/wreck-resolver.service';
import { CAMPAIGN_REPOSITORY } from './campaign.tokens';
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

/**
 * Module Campagne unifié — fusion des anciens modules `campaign/` (CRUD) et `game/`
 * (event sourcing DDD). Un seul agrégat racine `Campaign` (domain/campaign.ts).
 *
 * TeamModule fournit TeamService (vérification d'appartenance d'équipe) et exporte
 * TEAM_REPOSITORY, requis par CampaignRepository pour charger l'état figé des équipes.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CampaignOrm,
      CampaignParticipantOrm,
      GameOrm,
      GameResultOrm,
      GameEventOrm,
    ]),
    CatalogModule,
    TeamModule,
  ],
  controllers: [CampaignController, GameController],
  providers: [
    // Services (anémiques — migrés vers use cases en Phase 2)
    CampaignService,
    CampaignParticipantService,
    GameService,
    GameResultService,
    ScenarioCatalogService,

    // Infrastructure campagne
    CampaignMapper,
    { provide: CAMPAIGN_REPOSITORY, useClass: CampaignRepository },
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
  exports: [TypeOrmModule, CampaignService, ScenarioCatalogService, CampaignReplayService, CAMPAIGN_REPOSITORY],
})
export class CampaignModule {}
