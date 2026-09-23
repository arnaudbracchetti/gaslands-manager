import { IsArray, IsString } from 'class-validator';

/**
 * DTO pour PUT /api/campaigns/:id/house-rules — tableau requis (vide = aucune
 * règle active), pas de champ optionnel séparé contrairement au reste de la
 * campagne : cette route ne fait qu'une chose.
 */
export class SetHouseRulesDto {
  @IsArray()
  @IsString({ each: true })
  houseRules!: string[];
}
