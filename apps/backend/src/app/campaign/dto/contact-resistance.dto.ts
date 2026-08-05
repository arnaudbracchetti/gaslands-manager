import { IsInt, Min } from 'class-validator';

export class ContactResistanceDto {
  @IsInt()
  @Min(1)
  participantId!: number;
}
