import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Team } from './team.entity';
import { Vehicle } from '../vehicle/vehicle.entity';
import { SeasonParticipant } from '../season/season-participant.entity';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';

// forFeature([Team, Vehicle]) enregistre les DEUX entités dans ce module — pas
// seulement `Team`. `TeamService` a besoin de `Repository<Vehicle>` pour calculer
// `vehicleCount` par un vrai COUNT SQL (cf. son en-tête, et `findByUserId`/`update`
// ci-après). TypeORM autorise plusieurs `forFeature` sur la MÊME entité dans des
// modules différents — chacun obtient son propre token de Repository, indépendant
// de `VehicleModule` : on évite ainsi tout cycle d'imports `TeamModule ↔ VehicleModule`
// (qui, lui, a besoin de `TeamService` pour vérifier l'appartenance d'une équipe
// avant de créer/lister ses véhicules — cf. `vehicle.service.ts`).
//
// `exports: [..., TeamService]` : nécessaire pour que `VehicleModule` puisse
// l'injecter (cf. raisonnement ci-dessus) — `TypeOrmModule` reste exporté pour
// les usages préexistants (aucun changement de comportement pour eux).
@Module({
  imports: [TypeOrmModule.forFeature([Team, Vehicle, SeasonParticipant])],
  controllers: [TeamController],
  providers: [TeamService],
  exports: [TypeOrmModule, TeamService],
})
export class TeamModule {}
