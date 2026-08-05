import { IsInt, IsOptional, Min } from 'class-validator';

/**
 * DTO pour la demande d'inscription à une saison.
 *
 * `teamId` désigne l'équipe du demandeur — le use case vérifie qu'elle lui
 * appartient avant de créer le CampaignParticipant (RequestJoinUseCase,
 * ITeamRepository.findByIdForUser, même principe que CreateCampaignDto).
 */
export class JoinCampaignDto {
  // nullable : l'organisateur peut se désengager d'une saison en passant null —
  // `@IsOptional()` couvre `null` ET `undefined`, pas besoin de `@ValidateIf`.
  // `Team.id` est toujours une ligne réelle en base (jamais transiente), @Min(1) sûr ici.
  @IsOptional()
  @IsInt()
  @Min(1)
  teamId?: number | null;
}
