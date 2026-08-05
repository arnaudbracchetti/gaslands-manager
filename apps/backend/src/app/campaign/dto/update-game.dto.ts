import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { GameType } from '../game.enums';

/**
 * DTO pour la modification d'une partie PLANIFIE du Programme Télé.
 *
 * Tous les champs sont optionnels (mise à jour partielle). L'ordre n'est pas
 * modifiable dans US-A1 (auto-append uniquement). Le service refuse toute
 * modification d'une partie déjà JOUE.
 */
export class UpdateGameDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  scenarioId?: string;

  @IsOptional()
  @IsEnum(GameType)
  type?: GameType;
}
