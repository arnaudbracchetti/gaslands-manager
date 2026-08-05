import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nomInterne!: string;
}
