/**
 * Corps de `POST .../events/income` — revenu de base Escarmouche (1D6 serveur,
 * différé en fin de wizard, cf. `RollIncomeUseCase`).
 */
export class RollIncomeDto {
  participantId!: number;
}
