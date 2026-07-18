import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog/catalog.module';
import { CampaignParticipantOrm } from '../campaign/infrastructure/entities/campaign-participant.entity';

// ORM entities (nouvelle couche infrastructure)
import { TeamOrm } from './infrastructure/entities/team.entity';
import {
  VehicleOrm,
  VehicleImprovementOrm,
  VehicleAdvantageOrm,
} from './infrastructure/entities/vehicle.entity';
import { WeaponOrm } from './infrastructure/entities/weapon.entity';

// Infrastructure
import { CatalogAdapter } from './infrastructure/catalog.adapter';
import { TeamMapper } from './infrastructure/team.mapper';
import { TeamRepository } from './infrastructure/team.repository';

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
import { RenameVehicleUseCase } from './application/rename-vehicle.usecase';
import { GetVehicleDetailUseCase } from './application/get-vehicle-detail.usecase';

// Use cases — armes
import { GetAvailableWeaponsUseCase } from './application/get-available-weapons.usecase';
import { AddWeaponUseCase } from './application/add-weapon.usecase';
import { RemoveWeaponUseCase } from './application/remove-weapon.usecase';

// Use cases — améliorations
import { GetAvailableImprovementsUseCase } from './application/get-available-improvements.usecase';
import { AddImprovementUseCase } from './application/add-improvement.usecase';
import { RemoveImprovementUseCase } from './application/remove-improvement.usecase';

// Use cases — avantages
import { GetAvailableAdvantagesUseCase } from './application/get-available-advantages.usecase';
import { AddAdvantageUseCase } from './application/add-advantage.usecase';
import { RemoveAdvantageUseCase } from './application/remove-advantage.usecase';

import type { ITeamRepository } from './domain/team.repository.interface';
import type { ICatalogRepository } from './domain/catalog.repository.interface';
import { TEAM_REPOSITORY, CATALOG_REPOSITORY } from './team.tokens';

@Module({
  imports: [
    TypeOrmModule.forFeature([TeamOrm, VehicleOrm, VehicleImprovementOrm, VehicleAdvantageOrm, WeaponOrm, CampaignParticipantOrm]),
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
      provide: RenameVehicleUseCase,
      useFactory: (tr: ITeamRepository) => new RenameVehicleUseCase(tr),
      inject: [TEAM_REPOSITORY],
    },
    {
      provide: GetVehicleDetailUseCase,
      useFactory: (tr: ITeamRepository) => new GetVehicleDetailUseCase(tr),
      inject: [TEAM_REPOSITORY],
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

    // ── Use cases — avantages ─────────────────────────────────────────────────

    {
      provide: GetAvailableAdvantagesUseCase,
      useFactory: (tr: ITeamRepository, cr: ICatalogRepository) =>
        new GetAvailableAdvantagesUseCase(tr, cr),
      inject: [TEAM_REPOSITORY, CATALOG_REPOSITORY],
    },
    {
      provide: AddAdvantageUseCase,
      useFactory: (tr: ITeamRepository, cr: ICatalogRepository) =>
        new AddAdvantageUseCase(tr, cr),
      inject: [TEAM_REPOSITORY, CATALOG_REPOSITORY],
    },
    {
      provide: RemoveAdvantageUseCase,
      useFactory: (tr: ITeamRepository) => new RemoveAdvantageUseCase(tr),
      inject: [TEAM_REPOSITORY],
    },
  ],
  // TEAM_REPOSITORY est exporté pour CampaignModule (chargement de l'état figé des équipes
  // au replay, via ITeamRepository). TypeOrmModule est réexporté pour les entités partagées.
  exports: [TypeOrmModule, TEAM_REPOSITORY],
})
export class TeamModule {}
