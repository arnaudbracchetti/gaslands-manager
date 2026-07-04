export class DestroyedVehicleDto {
  vehicleId!: number;
  weightClass!: string;
}

export class RecordResultItemDto {
  participantId!: number;
  rank!: number;
  /** Portes franchies (exploit, US-B2) — optionnel, 0/absent si aucune. */
  gatesCrossed?: number;
  /** Véhicules ennemis détruits par poids (exploit, US-B2) — optionnel. */
  destroyedVehicles?: DestroyedVehicleDto[];
}

export class RecordResultDto {
  results!: RecordResultItemDto[];
}
