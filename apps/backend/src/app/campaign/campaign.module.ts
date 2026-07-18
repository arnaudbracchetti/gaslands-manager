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
import { RandomProvider } from './infrastructure/random-provider';
import { WreckTable } from './domain/wreck/wreck-table';
import { CAMPAIGN_REPOSITORY, RANDOMIZER } from './campaign.tokens';
import type { ICampaignRepository } from './domain/campaign.repository.interface';
import type { IRandomizer } from './domain/randomizer.interface';

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
import { ResetResultUseCase } from './application/reset-result.usecase';
import { RollIncomeUseCase } from './application/roll-income.usecase';
import { GetParticipantVehiclesUseCase } from './application/get-participant-vehicles.usecase';

// Use cases event sourcing (Parties 4-5)
import { RecordWalletMovementUseCase } from './application/record-wallet-movement.usecase';
import { RecordVehicleLostUseCase } from './application/record-vehicle-lost.usecase';
import { ContactResistanceUseCase } from './application/contact-resistance.usecase';
import { EnterAtelierUseCase } from './application/enter-atelier.usecase';
import { CloseAtelierUseCase } from './application/close-atelier.usecase';
import { GetStandingsUseCase } from './application/get-standings.usecase';
import { ChangeEquipmentUseCase } from './application/change-equipment.usecase';
import { RenameCampaignVehicleUseCase } from './application/rename-campaign-vehicle.usecase';
import { WreckResolveUseCase } from './application/wreck-resolve.usecase';
import { GetWorkshopUseCase } from './application/get-workshop.usecase';
import { GetWorkshopAvailableWeaponsUseCase } from './application/get-workshop-available-weapons.usecase';
import { GetWorkshopAvailableImprovementsUseCase } from './application/get-workshop-available-improvements.usecase';
import { GetWorkshopAvailableAdvantagesUseCase } from './application/get-workshop-available-advantages.usecase';
import { GetWorkshopAvailableSequellesUseCase } from './application/get-workshop-available-sequelles.usecase';

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
    { provide: RANDOMIZER, useClass: RandomProvider },
    {
      provide: WreckTable,
      useFactory: (r: IRandomizer, catalog: CatalogService) => new WreckTable(r, catalog),
      inject: [RANDOMIZER, CatalogService],
    },

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
      provide: ResetResultUseCase,
      useFactory: (repo: ICampaignRepository, replay: CampaignReplayService) =>
        new ResetResultUseCase(repo, replay),
      inject: [CAMPAIGN_REPOSITORY, CampaignReplayService],
    },
    {
      provide: RollIncomeUseCase,
      useFactory: (repo: ICampaignRepository, replay: CampaignReplayService, r: IRandomizer) =>
        new RollIncomeUseCase(repo, replay, r),
      inject: [CAMPAIGN_REPOSITORY, CampaignReplayService, RANDOMIZER],
    },
    {
      provide: GetParticipantVehiclesUseCase,
      useFactory: (replay: CampaignReplayService) => new GetParticipantVehiclesUseCase(replay),
      inject: [CampaignReplayService],
    },

    // ── Use cases event sourcing (Parties 4-5) ─────────────────────────────────
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
      provide: RenameCampaignVehicleUseCase,
      useFactory: (repo: ICampaignRepository, replay: CampaignReplayService) =>
        new RenameCampaignVehicleUseCase(repo, replay),
      inject: [CAMPAIGN_REPOSITORY, CampaignReplayService],
    },
    {
      provide: WreckResolveUseCase,
      useFactory: (repo: ICampaignRepository, replay: CampaignReplayService, wreckTable: WreckTable) =>
        new WreckResolveUseCase(repo, replay, wreckTable),
      inject: [CAMPAIGN_REPOSITORY, CampaignReplayService, WreckTable],
    },
    {
      provide: GetWorkshopUseCase,
      useFactory: (replay: CampaignReplayService) => new GetWorkshopUseCase(replay),
      inject: [CampaignReplayService],
    },
    {
      provide: GetWorkshopAvailableWeaponsUseCase,
      useFactory: (replay: CampaignReplayService, catalog: CatalogService) =>
        new GetWorkshopAvailableWeaponsUseCase(replay, catalog),
      inject: [CampaignReplayService, CatalogService],
    },
    {
      provide: GetWorkshopAvailableImprovementsUseCase,
      useFactory: (replay: CampaignReplayService, catalog: CatalogService) =>
        new GetWorkshopAvailableImprovementsUseCase(replay, catalog),
      inject: [CampaignReplayService, CatalogService],
    },
    {
      provide: GetWorkshopAvailableAdvantagesUseCase,
      useFactory: (replay: CampaignReplayService, catalog: CatalogService) =>
        new GetWorkshopAvailableAdvantagesUseCase(replay, catalog),
      inject: [CampaignReplayService, CatalogService],
    },
    {
      provide: GetWorkshopAvailableSequellesUseCase,
      useFactory: (replay: CampaignReplayService, catalog: CatalogService) =>
        new GetWorkshopAvailableSequellesUseCase(replay, catalog),
      inject: [CampaignReplayService, CatalogService],
    },
  ],
  exports: [TypeOrmModule, ScenarioCatalogService, CampaignReplayService, CAMPAIGN_REPOSITORY],
})
export class CampaignModule {}
