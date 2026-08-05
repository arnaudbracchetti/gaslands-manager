import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class WreckResolveDto {
  @IsInt()
  @Min(1)
  participantId!: number;

  // Pas de `@Min(1)` : le véhicule ciblé peut être une entité transiente D-S11
  // (acheté en atelier), id = `-event.id` (négatif).
  @IsInt()
  vehicleId!: number;

  /**
   * Attestation manuelle de l'organisateur : ce véhicule porte déjà un bonus "Favori du
   * public" en attente d'une partie précédente (ligne 9 de la Table des Épaves). Ignoré
   * si le tirage ne donne pas VEHICULE_DETRUIT.
   */
  @IsOptional()
  @IsBoolean()
  pendingFavoriDuPublic?: boolean;
}
