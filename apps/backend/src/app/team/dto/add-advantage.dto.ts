import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AddAdvantageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nomInterne!: string;
}
