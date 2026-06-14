import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Season } from './season.entity';
import { SeasonParticipant } from './season-participant.entity';
import { SeasonController } from './season.controller';
import { SeasonService } from './season.service';
import { TeamModule } from '../team/team.module';

// TeamModule importé pour injecter TeamService (vérification que `teamId`
// appartient à l'utilisateur lors de la création — cf. season.service.ts).
// TeamModule exporte déjà TeamService pour ce type de besoin (cf. VehicleModule).
@Module({
  imports: [TypeOrmModule.forFeature([Season, SeasonParticipant]), TeamModule],
  controllers: [SeasonController],
  providers: [SeasonService],
  exports: [TypeOrmModule, SeasonService],
})
export class SeasonModule {}
