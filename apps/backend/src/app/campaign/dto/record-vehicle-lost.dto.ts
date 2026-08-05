import { ArrayMaxSize, IsArray, IsInt, IsOptional, Min } from 'class-validator';

// Pas de `@Min(1)` sur `vehicleId`/`weaponIds` : un véhicule ou une arme achetés en
// atelier sont des entités transientes D-S11 dont l'id est `-event.id` (négatif),
// jamais réinséré en base — `Team.findVehicle` ne distingue jamais selon le signe.
export class RecordVehicleLostDto {
  @IsInt()
  @Min(1)
  participantId!: number;

  @IsInt()
  vehicleId!: number;

  /** Optionnel — armes perdues avec le véhicule. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  weaponIds?: number[];
}
