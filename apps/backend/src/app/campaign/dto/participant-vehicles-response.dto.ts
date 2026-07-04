/**
 * Véhicules courants d'un participant — alimente le picker "véhicules ennemis
 * détruits" de la saisie d'exploits (US-B2). `weightClass` est une valeur
 * `WeightClass` ('LEGER'|'MOYEN'|'LOURD'|'FORTERESSE'), déjà déduite du
 * catalogue côté backend — le frontend n'a qu'à la renvoyer telle quelle dans
 * `RecordResultDto.destroyedVehicles`.
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
