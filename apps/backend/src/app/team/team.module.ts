import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Team } from './team.entity';

// forFeature([Team]) enregistre l'entité Team dans ce module
// Cela permet d'injecter le Repository<Team> dans les services
@Module({
  imports: [TypeOrmModule.forFeature([Team])],
  exports: [TypeOrmModule], // Exporté pour être utilisable depuis d'autres modules
})
export class TeamModule {}
