/**
 * DTO pour la mise à jour partielle d'une équipe (PATCH-style).
 *
 * Tous les champs sont optionnels : le client n'envoie que ce qu'il veut modifier.
 * Le service backend fait un Object.assign() sur l'entité existante,
 * ce qui préserve les champs non fournis.
 */
export class UpdateTeamDto {
  name?: string;
  sponsor?: string;
  cans?: number;
  description?: string;
}
