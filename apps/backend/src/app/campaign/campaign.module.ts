import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campaign } from './campaign.entity';
import { CampaignParticipant } from './campaign-participant.entity';
import { CampaignController } from './campaign.controller';
import { CampaignService } from './campaign.service';
import { CampaignParticipantService } from './campaign-participant.service';
import { TeamModule } from '../team/team.module';

// TeamModule importé pour injecter TeamService (vérification que `teamId`
// appartient à l'utilisateur lors de la création — cf. season.service.ts).
// TeamModule exporte déjà TeamService pour ce type de besoin (cf. VehicleModule).
@Module({
  imports: [TypeOrmModule.forFeature([Campaign, CampaignParticipant]), TeamModule],
  controllers: [CampaignController],
  providers: [CampaignService, CampaignParticipantService],
  exports: [TypeOrmModule, CampaignService],
})
export class CampaignModule {}
