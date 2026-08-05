import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RenameVehicleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nom!: string;
}
