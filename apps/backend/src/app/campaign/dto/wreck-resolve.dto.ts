export class WreckResolveDto {
  participantId!: number;
  vehicleId!: number;
  /**
   * Attestation manuelle de l'organisateur : ce véhicule porte déjà un bonus "Favori du
   * public" en attente d'une partie précédente (ligne 9 de la Table des Épaves). Ignoré
   * si le tirage ne donne pas VEHICULE_DETRUIT.
   */
  pendingFavoriDuPublic?: boolean;
}
