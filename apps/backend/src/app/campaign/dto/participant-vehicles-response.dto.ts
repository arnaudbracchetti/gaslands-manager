/**
 * Véhicules courants d'un participant — alimente à la fois le picker "véhicules
 * ennemis détruits" de la saisie d'exploits (US-B2) et la garde d'éligibilité de la
 * case "Favori du public" de l'écran de désignation des épaves (cf.
 * `docs/spec/CAMPAIGN.md#faveur-du-public`). `weightClass` est une valeur
 * `WeightClass` ('LEGER'|'MOYEN'|'LOURD'|'FORTERESSE'), déjà déduite du
 * catalogue côté backend — usage purement informatif pour l'affichage du picker.
 * Le frontend ne la retransmet plus dans `RecordResultDto.destroyedVehicles` :
 * `Campaign.recordResult()` la redérive lui-même depuis le véhicule réel, pour
 * ne jamais faire confiance à une valeur fournie par l'appelant. `hasFavoriDuPublic`
 * est soumis à la même règle : le frontend s'en sert pour savoir quand afficher la
 * case, mais le serveur revérifie toujours cette même valeur avant de créditer le
 * bonus (`Game.creditFavoriDuPublicBonus`).
 */
export interface ParticipantVehicleDto {
  vehicleId: number;
  nom: string;
  weightClass: string;
  hasFavoriDuPublic: boolean;
}

export interface ParticipantVehiclesDto {
  participantId: number;
  vehicles: ParticipantVehicleDto[];
}
