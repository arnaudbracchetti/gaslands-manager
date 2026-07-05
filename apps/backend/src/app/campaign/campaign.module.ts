import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entités ORM (regroupées dans infrastructure/entities/)
import { CampaignOrm } from './infrastructure/entities/campaign.entity';
import { CampaignParticipantOrm } from './infrastructure/entities/campaign-participant.entity';
import { GameOrm } from './infrastructure/entities/game.entity';
import { GameEventOrm } from './infrastructure/entities/game-event.entity';

// Controller unique (fusion campaign + game)
import { CampaignController } from './campaign.controller';

// Lecture (CQRS) + catalogue
import { CampaignQueryService } from './campaign-query.service';
import { ScenarioCatalogService } from './scenario-catalog.service';

// Modules externes
import { CatalogModule } from '../catalog/catalog.module';
import { CatalogService } from '../catalog/catalog.service';
import { TeamModule } from '../team/team.module';
import { TEAM_REPOSITORY } from '../team/team.tokens';
import type { ITeamRepository } from '../team/domain/team.repository.interface';

// Infrastructure campagne (event sourcing + CRUD)
import { CampaignMapper } from './infrastructure/campaign.mapper';
import { CampaignRepository } from './infrastructure/campaign.repository';
import { CampaignReplayService } from './infrastructure/campaign-replay.service';
import { WreckResolverService } from './infrastructure/wreck-resolver.service';
import { CAMPAIGN_REPOSITORY } from './campaign.tokens';
import type { ICampaignRepository } from './domain/campaign.repository.interface';

// Use cases CRUD (Phase 2)
import { CreateCampaignUseCase } from './application/create-campaign.usecase';
import { ChangeStateUseCase } from './application/change-state.usecase';
import { DeleteCampaignUseCase } from './application/delete-campaign.usecase';
import { RequestJoinUseCase } from './application/request-join.usecase';
import { ValidateParticipantUseCase } from './application/validate-participant.usecase';
import { PromoteParticipantUseCase } from './application/promote-participant.usecase';
import { RemoveParticipantUseCase } from './application/remove-participant.usecase';
import { ChangeMyTeamUseCase } from './application/change-my-team.usecase';
import { AddGameUseCase } from './application/add-game.usecase';
import { UpdateGameUseCase } from './application/update-game.usecase';
import { RemoveGameUseCase } from './application/remove-game.usecase';
import { RecordResultUseCase } from './application/record-result.usecase';
import { GetParticipantVehiclesUseCase } from './application/get-participant-vehicles.usecase';

// Use cases event sourcing (Parties 4-5)
import { RecordRankingUseCase } from './application/record-ranking.usecase';
import { RecordWalletMovementUseCase } from './application/record-wallet-movement.usecase';
import { RecordVehicleLostUseCase } from './application/record-vehicle-lost.usecase';
import { ContactResistanceUseCase } from './application/contact-resistance.usecase';
import { EnterAtelierUseCase } from './application/enter-atelier.usecase';
import { CloseAtelierUseCase } from './application/close-atelier.usecase';
import { GetStandingsUseCase } from './application/get-standings.usecase';
import { ChangeEquipmentUseCase } from './application/change-equipment.usecase';
import { WreckResolveUseCase } from './application/wreck-resolve.usecase';
import { AddSequellaUseCase } from './application/add-sequella.usecase';
import { GetWorkshopUseCase } from './application/get-workshop.usecase';

/**
 * Module Campagne unifié (DDD). Agrégat racine `Campaign` (domain/campaign.ts) ;
 * un seul CampaignController mince déléguant aux use cases (écritures) et au
 * CampaignQueryService (lectures). Les services anémiques ont été supprimés en
 * Phase 2 ; les résultats de partie sont dérivés du journal `game_events`.
 *
 * TeamModule exporte TEAM_REPOSITORY (chargement des équipes engagées + contrôle
 * d'appartenance dans les use cases CRUD).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CampaignOrm,
      CampaignParticipantOrm,
      GameOrm,
      GameEventOrm,
    ]),
    CatalogModule,
    TeamModule,
  ],
  controllers: [CampaignController],
  providers: [
    // Lecture + catalogue
    CampaignQueryService,
    ScenarioCatalogService,

    // Infrastructure campagne
    CampaignMapper,
    { provide: CAMPAIGN_REPOSITORY, useClass: CampaignRepository },
    CampaignReplayService,
    WreckResolverService,

    // ── Use cases CRUD (useFactory — domaine sans décorateurs NestJS) ──────────
    {
      provide: CreateCampaignUseCase,
      useFactory: (repo: ICampaignRepository, team: ITeamRepository) =>
        new CreateCampaignUseCase(repo, team),
      inject: [CAMPAIGN_REPOSITORY, TEAM_REPOSITORY],
    },
    {
      provide: ChangeStateUseCase,
      useFactory: (repo: ICampaignRepository, replay: CampaignReplayService) =>
        new ChangeStateUseCase(repo, replay),
      inject: [CAMPAIGN_REPOSITORY, CampaignReplayService],
    },
    {
      provide: DeleteCampaignUseCase,
      useFactory: (repo: ICampaignRepository, replay: CampaignReplayService) =>
        new DeleteCampaignUseCase(repo, replay),
      inject: [CAMPAIGN_REPOSITORY, CampaignReplayService],
    },
    {
      provide: RequestJoinUseCase,
      useFactory: (repo: ICampaignRepository, replay: CampaignReplayService, team: ITeamRepository) =>
        new RequestJoinUseCase(repo, replay, team),
      inject: [CAMPAIGN_REPOSITORY, CampaignReplayService, TEAM_REPOSITORY],
    },
    {
      provide: ValidateParticipantUseCase,
      useFactory: (repo: ICampaignRepository, replay: CampaignReplayService) =>
        new ValidateParticipantUseCase(repo, replay),
      inject: [CAMPAIGN_REPOSITORY, CampaignReplayService],
    },
    {
      provide: PromoteParticipantUseCase,
      useFactory: (repo: ICampaignRepository, replay: CampaignReplayService) =>
        new PromoteParticipantUseCase(repo, replay),
      inject: [CAMPAIGN_REPOSITORY, CampaignReplayService],
    },
    {
      provide: RemoveParticipantUseCase,
      useFactory: (repo: ICampaignRepository, replay: CampaignReplayService) =>
        new RemoveParticipantUseCase(repo, replay),
      inject: [CAMPAIGN_REPOSITORY, CampaignReplayService],
    },
    {
      provide: ChangeMyTeamUseCase,
      useFactory: (repo: ICampaignRepository, replay: CampaignReplayService, team: ITeamRepository) =>
        new ChangeMyTeamUseCase(repo, replay, team),
      inject: [CAMPAIGN_REPOSITORY, CampaignReplayService, TEAM_REPOSITORY],
    },
    {
      provide: AddGameUseCase,
      useFactory: (repo: ICampaignRepository, replay: CampaignReplayService, scenarios: ScenarioCatalogService) =>
        new AddGameUseCase(repo, replay, scenarios),
      inject: [CAMPAIGN_REPOSITORY, CampaignReplayService, ScenarioCatalogService],
    },
    {
      provide: UpdateGameUseCase,
      useFactory: (repo: ICampaignRepository, replay: CampaignReplayService, scenarios: ScenarioCatalogService) =>
        new UpdateGameUseCase(repo, replay, scenarios),
      inject: [CAMPAIGN_REPOSITORY, CampaignReplayService, ScenarioCatalogService],
    },
    {
      provide: RemoveGameUseCase,
      useFactory: (repo: ICampaignRepository, replay: CampaignReplayService) =>
        new RemoveGameUseCase(repo, replay),
      inject: [CAMPAIGN_REPOSITORY, CampaignReplayService],
    },
    {
      provide: RecordResultUseCase,
      useFactory: (repo: ICampaignRepository, replay: CampaignReplayService) =>
        new RecordResultUseCase(repo, replay),
      inject: [CAMPAIGN_REPOSITORY, CampaignReplayService],
    },
    {
      provide: GetParticipantVehiclesUseCase,
      useFactory: (replay: CampaignReplayService) => new GetParticipantVehiclesUseCase(replay),
      inject: [CampaignReplayService],
    },

    // ── Use cases event sourcing (Parties 4-5) ─────────────────────────────────
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
      provide: EnterAtelierUseCase,
      useFactory: (repo: ICampaignRepository, replay: CampaignReplayService) =>
        new EnterAtelierUseCase(repo, replay),
      inject: [CAMPAIGN_REPOSITORY, CampaignReplayService],
    },
    {
      provide: CloseAtelierUseCase,
      useFactory: (repo: ICampaignRepository, replay: CampaignReplayService) =>
        new CloseAtelierUseCase(repo, replay),
      inject: [CAMPAIGN_REPOSITORY, CampaignReplayService],
    },
    {
      provide: GetStandingsUseCase,
      useFactory: (repo: ICampaignRepository, replay: CampaignReplayService) =>
        new GetStandingsUseCase(repo, replay),
      inject: [CAMPAIGN_REPOSITORY, CampaignReplayService],
    },
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
    {
      provide: GetWorkshopUseCase,
      useFactory: (replay: CampaignReplayService) => new GetWorkshopUseCase(replay),
      inject: [CampaignReplayService],
    },
  ],
  exports: [TypeOrmModule, ScenarioCatalogService, CampaignReplayService, CAMPAIGN_REPOSITORY],
})
export class CampaignModule {}
