/**
 * VehicleModule — Module NestJS pour la gestion des véhicules d'équipe.
 *
 * Architecture DDD : ce module câble les trois couches (domain, application, infrastructure)
 * sans que les use cases n'aient à connaître les tokens NestJS.
 *
 * Stratégie d'injection :
 *  - VehicleRepository et CatalogAdapter sont fournis en tant que classes (@Injectable)
 *    et référencés par leurs tokens string via `provide: VEHICLE_REPOSITORY`.
 *  - Les use cases sont fournis en `useFactory`, recevant les repos déjà instanciés.
 *    Cela évite de polluer les classes de domaine avec des décorateurs NestJS.
 *  - WeaponController est déclaré ici (module fusionné depuis weapon/).
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vehicle as VehicleOrm, VehicleImprovement as VehicleImprovementOrm } from './vehicle.entity';
import { Weapon as WeaponOrm } from '../weapon/weapon.entity';
import { VehicleController } from './vehicle.controller';
import { VehicleTeamController } from './vehicle-team.controller';
import { WeaponController } from './weapon.controller';
import { VehicleBuildFactory } from './vehicle-build.factory';
import { ImprovementDecoratorFactory } from './improvement-decorator.factory';
import { VehicleRepository } from './infrastructure/vehicle.repository';
import { VehicleMapper } from './infrastructure/vehicle.mapper';
import { CatalogAdapter } from './infrastructure/catalog.adapter';
import { CreateVehicleUseCase } from './application/create-vehicle.usecase';
import { AddWeaponUseCase } from './application/add-weapon.usecase';
import { RemoveWeaponUseCase } from './application/remove-weapon.usecase';
import { AddImprovementUseCase } from './application/add-improvement.usecase';
import { RemoveImprovementUseCase } from './application/remove-improvement.usecase';
import { AssignWeaponToTourelleUseCase } from './application/assign-weapon-to-tourelle.usecase';
import { UnassignWeaponFromTourelleUseCase } from './application/unassign-weapon-from-tourelle.usecase';
import { GetAvailableWeaponsUseCase } from './application/get-available-weapons.usecase';
import { GetAvailableImprovementsUseCase } from './application/get-available-improvements.usecase';
import { GetVehicleDetailUseCase } from './application/get-vehicle-detail.usecase';
import { RemoveVehicleUseCase } from './application/remove-vehicle.usecase';
import { VEHICLE_REPOSITORY, CATALOG_REPOSITORY } from './vehicle.tokens';
import { CatalogModule } from '../catalog/catalog.module';
import { TeamModule } from '../team/team.module';
import type { IVehicleRepository } from './domain/vehicle.repository.interface';
import type { ICatalogRepository } from './domain/catalog.repository.interface';

@Module({
  imports: [
    TypeOrmModule.forFeature([VehicleOrm, VehicleImprovementOrm, WeaponOrm]),
    CatalogModule,
    TeamModule,
  ],
  controllers: [VehicleController, VehicleTeamController, WeaponController],
  providers: [
    // ── Infrastructure ────────────────────────────────────────────────────────
    VehicleBuildFactory,
    ImprovementDecoratorFactory,
    { provide: CATALOG_REPOSITORY, useClass: CatalogAdapter },
    {
      provide: VehicleMapper,
      useFactory: (cr: ICatalogRepository) => new VehicleMapper(cr),
      inject: [CATALOG_REPOSITORY],
    },
    { provide: VEHICLE_REPOSITORY, useClass: VehicleRepository },

    // ── Use cases — fournis en useFactory pour injecter les interfaces sans décorateurs ──
    {
      provide: CreateVehicleUseCase,
      useFactory: (vr: IVehicleRepository, cr: ICatalogRepository) => new CreateVehicleUseCase(vr, cr),
      inject: [VEHICLE_REPOSITORY, CATALOG_REPOSITORY],
    },
    {
      provide: AddWeaponUseCase,
      useFactory: (vr: IVehicleRepository, cr: ICatalogRepository) => new AddWeaponUseCase(vr, cr),
      inject: [VEHICLE_REPOSITORY, CATALOG_REPOSITORY],
    },
    {
      provide: RemoveWeaponUseCase,
      useFactory: (vr: IVehicleRepository, cr: ICatalogRepository) => new RemoveWeaponUseCase(vr, cr),
      inject: [VEHICLE_REPOSITORY, CATALOG_REPOSITORY],
    },
    {
      provide: AddImprovementUseCase,
      useFactory: (vr: IVehicleRepository, cr: ICatalogRepository) => new AddImprovementUseCase(vr, cr),
      inject: [VEHICLE_REPOSITORY, CATALOG_REPOSITORY],
    },
    {
      provide: RemoveImprovementUseCase,
      useFactory: (vr: IVehicleRepository, cr: ICatalogRepository) => new RemoveImprovementUseCase(vr, cr),
      inject: [VEHICLE_REPOSITORY, CATALOG_REPOSITORY],
    },
    {
      provide: AssignWeaponToTourelleUseCase,
      useFactory: (vr: IVehicleRepository, cr: ICatalogRepository) => new AssignWeaponToTourelleUseCase(vr, cr),
      inject: [VEHICLE_REPOSITORY, CATALOG_REPOSITORY],
    },
    {
      provide: UnassignWeaponFromTourelleUseCase,
      useFactory: (vr: IVehicleRepository, cr: ICatalogRepository) => new UnassignWeaponFromTourelleUseCase(vr, cr),
      inject: [VEHICLE_REPOSITORY, CATALOG_REPOSITORY],
    },
    {
      provide: GetAvailableWeaponsUseCase,
      useFactory: (vr: IVehicleRepository, cr: ICatalogRepository) => new GetAvailableWeaponsUseCase(vr, cr),
      inject: [VEHICLE_REPOSITORY, CATALOG_REPOSITORY],
    },
    {
      provide: GetAvailableImprovementsUseCase,
      useFactory: (vr: IVehicleRepository, cr: ICatalogRepository) => new GetAvailableImprovementsUseCase(vr, cr),
      inject: [VEHICLE_REPOSITORY, CATALOG_REPOSITORY],
    },
    {
      provide: GetVehicleDetailUseCase,
      useFactory: (vr: IVehicleRepository, cr: ICatalogRepository, bf: VehicleBuildFactory) =>
        new GetVehicleDetailUseCase(vr, cr, bf),
      inject: [VEHICLE_REPOSITORY, CATALOG_REPOSITORY, VehicleBuildFactory],
    },
    {
      provide: RemoveVehicleUseCase,
      useFactory: (vr: IVehicleRepository, cr: ICatalogRepository) => new RemoveVehicleUseCase(vr, cr),
      inject: [VEHICLE_REPOSITORY, CATALOG_REPOSITORY],
    },
  ],
  exports: [TypeOrmModule, VEHICLE_REPOSITORY],
})
export class VehicleModule {}
