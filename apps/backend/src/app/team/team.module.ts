import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Team } from './team.entity';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';

// forFeature([Team]) enregistre l'entité Team dans ce module
// Cela permet d'injecter le Repository<Team> dans TeamService via @InjectRepository(Team)
@Module({
  imports: [TypeOrmModule.forFeature([Team])],
  controllers: [TeamController],
  providers: [TeamService],
  exports: [TypeOrmModule],
})
export class TeamModule {}
