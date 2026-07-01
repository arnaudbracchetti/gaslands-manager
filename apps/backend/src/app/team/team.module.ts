import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog/catalog.module';
import { CatalogService } from '../catalog/catalog.service';
import { CampaignParticipantOrm } from '../campaign/infrastructure/entities/campaign-participant.entity';

// ORM entities (nouvelle couche infrastructure)
import { TeamOrm } from './infrastructure/entities/team.entity';
import {
  VehicleOrm,
  VehicleImprovementOrm,
} from './infrastructure/entities/vehicle.entity';
import { WeaponOrm } from './infrastructure/entities/weapon.entity';

// Infrastructure
import { CatalogAdapter } from './infrastructure/catalog.adapter';
import { TeamMapper } from './infrastructure/team.mapper';
import { TeamRepository } from './infrastructure/team.repository';

// Factories (Pattern Decorator pour les stats de véhicule)
import { ImprovementDecoratorFactory } from './improvement-decorator.factory';
import { VehicleBuildFactory } from './vehicle-build.factory';

// TeamService — conservé pour SeasonModule (findOneForUser)
import { TeamService } from './team.service';

// Controllers
import { TeamController } from './team.controller';
import { VehicleTeamController } from './vehicle-team.controller';
import { VehicleController } from './vehicle.controller';
import { WeaponController } from './weapon.controller';

// Use cases — équipe
import { GetTeamSummariesUseCase } from './application/get-team-summaries.usecase';
import { CreateTeamUseCase } from './application/create-team.usecase';
import { UpdateTeamUseCase } from './application/update-team.usecase';
import { RemoveTeamUseCase } from './application/remove-team.usecase';

// Use cases — véhicule
import { AddVehicleUseCase } from './application/add-vehicle.usecase';
import { RemoveVehicleUseCase } from './application/remove-vehicle.usecase';
import { GetVehicleDetailUseCase } from './application/get-vehicle-detail.usecase';

// Use cases — armes
import { GetAvailableWeaponsUseCase } from './application/get-available-weapons.usecase';
import { AddWeaponUseCase } from './application/add-weapon.usecase';
import { RemoveWeaponUseCase } from './application/remove-weapon.usecase';

// Use cases — améliorations
import { GetAvailableImprovementsUseCase } from './application/get-available-improvements.usecase';
import { AddImprovementUseCase } from './application/add-improvement.usecase';
import { RemoveImprovementUseCase } from './application/remove-improvement.usecase';
import { AssignWeaponToTourelleUseCase } from './application/assign-weapon-to-tourelle.usecase';
import { UnassignWeaponFromTourelleUseCase } from './application/unassign-weapon-from-tourelle.usecase';

import type { ITeamRepository } from './domain/team.repository.interface';
import type { ICatalogRepository } from './domain/catalog.repository.interface';
import { TEAM_REPOSITORY, CATALOG_REPOSITORY } from './team.tokens';

@Module({
  imports: [
    TypeOrmModule.forFeature([TeamOrm, VehicleOrm, VehicleImprovementOrm, WeaponOrm, CampaignParticipantOrm]),
    CatalogModule,
  ],
  controllers: [TeamController, VehicleTeamController, VehicleController, WeaponController],
  providers: [
    // ── Couche infrastructure ──────────────────────────────────────────────────

    // Pont ICatalogRepository → CatalogService
    { provide: CATALOG_REPOSITORY, useClass: CatalogAdapter },

    // TeamMapper a besoin d'ICatalogRepository pour résoudre les Value Objects
    {
      provide: TeamMapper,
      useFactory: (cr: ICatalogRepository) => new TeamMapper(cr),
      inject: [CATALOG_REPOSITORY],
    },

    // TeamRepository implémente ITeamRepository (decoré @Injectable, injecté via token)
    { provide: TEAM_REPOSITORY, useClass: TeamRepository },

    // Factories pour le Pattern Decorator (stats véhicule accumulées)
    ImprovementDecoratorFactory,
    {
      provide: VehicleBuildFactory,
      useFactory: (cs: CatalogService, df: ImprovementDecoratorFactory) =>
        new VehicleBuildFactory(cs, df),
      inject: [CatalogService, ImprovementDecoratorFactory],
    },

    // ── Use cases — équipe ────────────────────────────────────────────────────

    {
      provide: GetTeamSummariesUseCase,
      useFactory: (tr: ITeamRepository) => new GetTeamSummariesUseCase(tr),
      inject: [TEAM_REPOSITORY],
    },
    {
      provide: CreateTeamUseCase,
      useFactory: (tr: ITeamRepository) => new CreateTeamUseCase(tr),
      inject: [TEAM_REPOSITORY],
    },
    {
      provide: UpdateTeamUseCase,
      useFactory: (tr: ITeamRepository) => new UpdateTeamUseCase(tr),
      inject: [TEAM_REPOSITORY],
    },
    {
      provide: RemoveTeamUseCase,
      useFactory: (tr: ITeamRepository) => new RemoveTeamUseCase(tr),
      inject: [TEAM_REPOSITORY],
    },

    // ── Use cases — véhicule ─────────────────────────────────────────────────

    {
      provide: AddVehicleUseCase,
      useFactory: (tr: ITeamRepository, cr: ICatalogRepository) => new AddVehicleUseCase(tr, cr),
      inject: [TEAM_REPOSITORY, CATALOG_REPOSITORY],
    },
    {
      provide: RemoveVehicleUseCase,
      useFactory: (tr: ITeamRepository) => new RemoveVehicleUseCase(tr),
      inject: [TEAM_REPOSITORY],
    },
    {
      provide: GetVehicleDetailUseCase,
      useFactory: (tr: ITeamRepository, cr: ICatalogRepository, bf: VehicleBuildFactory) =>
        new GetVehicleDetailUseCase(tr, cr, bf),
      inject: [TEAM_REPOSITORY, CATALOG_REPOSITORY, VehicleBuildFactory],
    },

    // ── Use cases — armes ─────────────────────────────────────────────────────

    {
      provide: GetAvailableWeaponsUseCase,
      useFactory: (tr: ITeamRepository, cr: ICatalogRepository) =>
        new GetAvailableWeaponsUseCase(tr, cr),
      inject: [TEAM_REPOSITORY, CATALOG_REPOSITORY],
    },
    {
      provide: AddWeaponUseCase,
      useFactory: (tr: ITeamRepository, cr: ICatalogRepository) => new AddWeaponUseCase(tr, cr),
      inject: [TEAM_REPOSITORY, CATALOG_REPOSITORY],
    },
    {
      provide: RemoveWeaponUseCase,
      useFactory: (tr: ITeamRepository) => new RemoveWeaponUseCase(tr),
      inject: [TEAM_REPOSITORY],
    },

    // ── Use cases — améliorations ─────────────────────────────────────────────

    {
      provide: GetAvailableImprovementsUseCase,
      useFactory: (tr: ITeamRepository, cr: ICatalogRepository) =>
        new GetAvailableImprovementsUseCase(tr, cr),
      inject: [TEAM_REPOSITORY, CATALOG_REPOSITORY],
    },
    {
      provide: AddImprovementUseCase,
      useFactory: (tr: ITeamRepository, cr: ICatalogRepository) =>
        new AddImprovementUseCase(tr, cr),
      inject: [TEAM_REPOSITORY, CATALOG_REPOSITORY],
    },
    {
      provide: RemoveImprovementUseCase,
      useFactory: (tr: ITeamRepository) => new RemoveImprovementUseCase(tr),
      inject: [TEAM_REPOSITORY],
    },
    {
      provide: AssignWeaponToTourelleUseCase,
      useFactory: (tr: ITeamRepository, cr: ICatalogRepository) =>
        new AssignWeaponToTourelleUseCase(tr, cr),
      inject: [TEAM_REPOSITORY, CATALOG_REPOSITORY],
    },
    {
      provide: UnassignWeaponFromTourelleUseCase,
      useFactory: (tr: ITeamRepository) => new UnassignWeaponFromTourelleUseCase(tr),
      inject: [TEAM_REPOSITORY],
    },

    // TeamService — conservé temporairement pour CampaignModule (CampaignService.findOneForUser)
    TeamService,
  ],
  exports: [TypeOrmModule, TeamService, TEAM_REPOSITORY],
})
export class TeamModule {}
