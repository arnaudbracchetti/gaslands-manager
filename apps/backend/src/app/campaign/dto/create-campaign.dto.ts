/**
 * DTO pour la création d'une saison.
 *
 * `teamId` désigne l'équipe du créateur qui participera à la saison —
 * optionnel : l'organisateur peut gérer une saison sans équipe engagée
 * (décision de design, cf. docs/plans/design/README.md §divergences).
 * Si fourni, le use case vérifie qu'elle lui appartient (ITeamRepository.findByIdForUser).
 */
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  teamId?: number;
}
