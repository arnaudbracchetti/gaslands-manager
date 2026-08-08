/**
 * DTO pour la création d'une saison.
 *
 * `teamId` désigne l'équipe du créateur qui participera à la saison —
 * optionnel : l'organisateur peut gérer une saison sans équipe engagée
 * (décision de design, cf. docs/plans/design/README.md §divergences).
 * Si fourni, le use case vérifie qu'elle lui appartient (ITeamRepository.findByIdForUser).
 */
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  teamId?: number;

  /**
   * Budget en jerricans imposé à toutes les équipes de la campagne (cf. Team.budget) -
   * défaut 50 (même défaut que Team.cans) si non fourni, cf. CreateCampaignUseCase.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  budget?: number;
}
