export class WreckResolveDto {
  participantId!: number;
  vehicleId!: number;
  /** Optionnel — arme choisie par le joueur si le résultat anticipé est ARME_PERDUE. */
  weaponIdChoice?: number | null;
}
