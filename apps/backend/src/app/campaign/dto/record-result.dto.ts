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

/** Butin manuel de jerricans (scénario `gain_jerricans`) — Escarmouche uniquement. */
export class JerricanGainDto {
  participantId!: number;
  amount!: number;
}

/**
 * Véhicule ennemi détruit hors classement (Escarmouche) — trace journal uniquement,
 * 0 Point de Championnat (contrairement à `DestroyedVehicleDto`, imbriqué sous
 * `RecordResultItemDto.destroyedVehicles` pour un Événement Télévisé).
 */
export class EscarmoucheDestroyedVehicleDto {
  destroyerId!: number;
  vehicleId!: number;
}

/**
 * Corps de `POST .../results`. Les trois champs sont indépendants et optionnels :
 * `results` (classement + exploits) n'est envoyé que pour un Événement Télévisé ;
 * `jerricanGains`/`destroyedVehicles` (à plat) uniquement pour une Escarmouche.
 */
export class RecordResultDto {
  results?: RecordResultItemDto[];
  jerricanGains?: JerricanGainDto[];
  destroyedVehicles?: EscarmoucheDestroyedVehicleDto[];
}
