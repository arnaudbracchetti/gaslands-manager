/**
 * Véhicules courants d'un participant — alimente le picker "véhicules ennemis
 * détruits" de la saisie d'exploits (US-B2). `weightClass` est une valeur
 * `WeightClass` ('LEGER'|'MOYEN'|'LOURD'|'FORTERESSE'), déjà déduite du
 * catalogue côté backend — usage purement informatif pour l'affichage du picker.
 * Le frontend ne la retransmet plus dans `RecordResultDto.destroyedVehicles` :
 * `Campaign.recordResult()` la redérive lui-même depuis le véhicule réel, pour
 * ne jamais faire confiance à une valeur fournie par l'appelant.
 */
export interface ParticipantVehicleDto {
  vehicleId: number;
  nom: string;
  weightClass: string;
}

export interface ParticipantVehiclesDto {
  participantId: number;
  vehicles: ParticipantVehicleDto[];
}
