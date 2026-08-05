/**
 * Corps de `POST .../events/income` — revenu de base Escarmouche (1D6 serveur,
 * différé en fin de wizard, cf. `RollIncomeUseCase`).
 */
import { IsInt, Min } from 'class-validator';

export class RollIncomeDto {
  @IsInt()
  @Min(1)
  participantId!: number;
}
