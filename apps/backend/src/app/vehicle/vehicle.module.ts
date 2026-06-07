/**
 * VehicleModule — Module NestJS pour la gestion des véhicules d'équipe.
 *
 * Pièces assemblées ici :
 *  - `TypeOrmModule.forFeature([Vehicle, VehicleImprovement])` enregistre les deux
 *    entités du module — c'est ce qui permet à `VehicleService` d'injecter leurs
 *    `Repository<T>` via `@InjectRepository` (même mécanisme que `TeamModule`).
 *  - `CatalogModule` apporte `CatalogService` (déjà exporté pour cet usage, cf. son
 *    commentaire d'en-tête) : `VehicleService`/`VehicleBuildFactory` en ont besoin
 *    pour résoudre les véhicules/améliorations du catalogue par `nom_interne`.
 *  - Les deux Factories du Pattern Decorator (`VehicleBuildFactory`,
 *    `ImprovementDecoratorFactory`) sont déclarées comme `providers` au même titre
 *    que `VehicleService` — ce sont des collaborateurs métier injectables, pas de
 *    simples fonctions utilitaires (cf. leurs en-têtes respectifs).
 *  - `VehicleController` expose l'API REST `/api/vehicles` (cf. son en-tête pour
 *    le détail des routes et la justification de leur nichage "à plat").
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vehicle, VehicleImprovement } from './vehicle.entity';
import { VehicleController } from './vehicle.controller';
import { VehicleService } from './vehicle.service';
import { VehicleBuildFactory } from './vehicle-build.factory';
import { ImprovementDecoratorFactory } from './improvement-decorator.factory';
import { CatalogModule } from '../catalog/catalog.module';

@Module({
  imports: [TypeOrmModule.forFeature([Vehicle, VehicleImprovement]), CatalogModule],
  controllers: [VehicleController],
  providers: [VehicleService, VehicleBuildFactory, ImprovementDecoratorFactory],
  exports: [TypeOrmModule, VehicleService],
})
export class VehicleModule {}
