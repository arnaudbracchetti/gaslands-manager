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
 *  - `TeamModule` apporte `TeamService` (exporté spécifiquement pour cet usage,
 *    cf. son en-tête) : `VehicleService.findAllForTeam`/`create` en ont besoin pour
 *    vérifier que l'équipe ciblée appartient bien à l'utilisateur AVANT de lister
 *    ou créer ses véhicules — `Vehicle` ne porte pas `userId` directement, `Team` si.
 *    Pas de cycle : `TeamModule` enregistre `Repository<Vehicle>` directement via
 *    `forFeature` plutôt que d'importer ce module en entier (cf. son en-tête).
 *  - Les deux Factories du Pattern Decorator (`VehicleBuildFactory`,
 *    `ImprovementDecoratorFactory`) sont déclarées comme `providers` au même titre
 *    que `VehicleService` — ce sont des collaborateurs métier injectables, pas de
 *    simples fonctions utilitaires (cf. leurs en-têtes respectifs).
 *  - `VehicleController` expose l'API REST `/api/vehicles` (cf. son en-tête pour
 *    le détail des routes et la justification de leur nichage "à plat") ;
 *    `VehicleTeamController` expose les routes "nichées" `/api/teams/:teamId/vehicles`
 *    (liste/création — cf. son en-tête pour la raison de cette séparation en deux
 *    controllers). Les deux délèguent au même `VehicleService`.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vehicle, VehicleImprovement } from './vehicle.entity';
import { VehicleController } from './vehicle.controller';
import { VehicleTeamController } from './vehicle-team.controller';
import { VehicleService } from './vehicle.service';
import { VehicleBuildFactory } from './vehicle-build.factory';
import { ImprovementDecoratorFactory } from './improvement-decorator.factory';
import { CatalogModule } from '../catalog/catalog.module';
import { TeamModule } from '../team/team.module';

@Module({
  imports: [TypeOrmModule.forFeature([Vehicle, VehicleImprovement]), CatalogModule, TeamModule],
  controllers: [VehicleController, VehicleTeamController],
  providers: [VehicleService, VehicleBuildFactory, ImprovementDecoratorFactory],
  exports: [TypeOrmModule, VehicleService],
})
export class VehicleModule {}
