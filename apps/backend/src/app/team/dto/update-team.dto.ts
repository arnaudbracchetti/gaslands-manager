/**
 * DTO pour la mise à jour partielle d'une équipe (PATCH-style).
 *
 * Tous les champs sont optionnels : le client n'envoie que ce qu'il veut modifier.
 * Le service backend fait un Object.assign() sur l'entité existante,
 * ce qui préserve les champs non fournis.
 */
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  sponsor?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  cans?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
