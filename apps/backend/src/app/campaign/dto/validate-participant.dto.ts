import { IsBoolean } from 'class-validator';

/**
 * DTO du corps de PUT /api/seasons/:id/participants/:pid/validate.
 *
 * `accept: true` → status passe à VALIDATED, `accept: false` → REJECTED
 * (cf. CampaignParticipantService.validate).
 */
export class ValidateParticipantDto {
  @IsBoolean()
  accept!: boolean;
}
