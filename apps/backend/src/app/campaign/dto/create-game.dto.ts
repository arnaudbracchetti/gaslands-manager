import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { GameType } from '../game.enums';

/**
 * DTO pour l'ajout d'une partie au Programme Télé.
 *
 * - `scenarioId` : nom_interne d'un scénario du catalogue (ScenarioCatalogService).
 *   `class-validator` ne vérifie que la forme (chaîne non vide) — l'existence dans
 *   le catalogue reste validée côté service (BadRequestException si inconnu).
 * - `type` : optionnel — par défaut, le service reprend le type du scénario.
 *   Permet de forcer Escarmouche/Événement Télévisé si le MJ le souhaite.
 */
export class CreateGameDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  scenarioId!: string;

  @IsOptional()
  @IsEnum(GameType)
  type?: GameType;
}
