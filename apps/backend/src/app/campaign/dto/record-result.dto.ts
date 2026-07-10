/** `weightClass` n'est PAS transmis — dérivé côté serveur depuis le véhicule réel. */
export class DestroyedVehicleDto {
  vehicleId!: number;
}

export class RecordResultItemDto {
  participantId!: number;
  rank!: number;
  /** Portes franchies (exploit, US-B2) — optionnel, 0/absent si aucune. */
  gatesCrossed?: number;
  /** Véhicules ennemis détruits (exploit, US-B2) — optionnel. */
  destroyedVehicles?: DestroyedVehicleDto[];
}

export class RecordResultDto {
  results!: RecordResultItemDto[];
}
