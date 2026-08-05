import { IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { EquipmentOperation, EquipmentEntityType } from '../domain/events/equipment-changed.event';
import type { WeaponOrientation } from '../../team/domain/team';

export class ChangeEquipmentDto {
  @IsEnum(EquipmentOperation)
  operation!: EquipmentOperation;

  @IsEnum(EquipmentEntityType)
  entityType!: EquipmentEntityType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nomInterne!: string;

  // `@IsOptional()` couvre `null` ET `undefined` — pas besoin de `@ValidateIf`.
  // Pas de `@Min(1)` : une entité achetée cette session (ou une session d'atelier
  // antérieure) est transiente D-S11, id = `-event.id` (négatif) — jamais réinséré
  // en base, `Team.findVehicle`/équivalents ne distinguent jamais selon le signe.
  @IsOptional()
  @IsInt()
  targetVehicleId?: number | null;

  @IsOptional()
  @IsInt()
  targetEntityId?: number | null;

  /** WEAPON : 5 valeurs possibles (dont `'tourelle'` — arc à 360°, coût ×3).
   * `WeaponOrientation` est une union de littéraux TS, pas un `enum` — `@IsIn()`. */
  @IsOptional()
  @IsIn(['avant', 'arrière', 'lateral', 'tourelle'])
  orientation?: WeaponOrientation | null;

  /** BUY(SEQUELLE, 'dur_a_cuire') uniquement — nom_interne de l'avantage gratuit choisi. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  freeAdvantageNomInterne?: string | null;
}
