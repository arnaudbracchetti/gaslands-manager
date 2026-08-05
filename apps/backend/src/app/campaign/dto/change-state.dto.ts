import { IsEnum } from 'class-validator';
import { CampaignState } from '../domain/enums/campaign.enums';

export class ChangeStateDto {
  @IsEnum(CampaignState)
  state!: CampaignState;
}
