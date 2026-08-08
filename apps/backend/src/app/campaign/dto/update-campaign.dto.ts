/**
 * DTO pour la modification d'une campagne (organisateur, EN_CONSTRUCTION uniquement).
 *
 * Nom et budget sont tous deux obligatoires : un seul formulaire d'édition envoie
 * toujours les deux ensemble (cf. docs/spec/CAMPAIGN.md - Budget de campagne).
 */
import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateCampaignDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(999)
  budget!: number;
}
