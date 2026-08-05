import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Orientation } from '../domain/team';

export class AddImprovementDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nomInterne!: string;

  // `Orientation` est une union de littéraux TS, pas un `enum` — `@IsIn()`
  // et non `@IsEnum()` (qui exige une vraie valeur enum à l'exécution).
  @IsOptional()
  @IsIn(['avant', 'arrière', 'lateral'])
  orientation?: Orientation;
}
