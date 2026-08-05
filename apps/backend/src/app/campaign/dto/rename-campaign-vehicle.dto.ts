import { IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RenameCampaignVehicleDto {
  // Pas de `@Min(1)` : le véhicule renommé peut être une entité transiente D-S11
  // (acheté cette session ou une session d'atelier antérieure), id = `-event.id`
  // (négatif) — cf. spec/CAMPAIGN.md §Renommage d'un véhicule en atelier.
  @IsInt()
  vehicleId!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nom!: string;
}
