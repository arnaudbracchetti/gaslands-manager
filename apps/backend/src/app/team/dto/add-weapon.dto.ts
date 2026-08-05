import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import type { WeaponOrientation } from '../domain/team';

export class AddWeaponDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nomInterne!: string;

  /** 5 valeurs possibles, dont `'tourelle'` (montage sur Tourelle — arc à 360°, coût ×3).
   * `WeaponOrientation` est une union de littéraux TS, pas un `enum` — `@IsIn()`. */
  @IsOptional()
  @IsIn(['avant', 'arrière', 'lateral', 'tourelle'])
  orientation?: WeaponOrientation;
}
