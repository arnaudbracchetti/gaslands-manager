/**
 * DTO pour PATCH /api/auth/me — mise à jour du profil de l'utilisateur connecté.
 * Pas de class-validator (convention du projet) : la validation vit dans
 * l'agrégat `User` (domain/).
 *
 * `role` en est absent — un utilisateur ne change jamais son propre rôle.
 */
export class UpdateProfileDto {
  firstName: string;
  lastName: string;
  /** Nom d'affichage vu par les autres joueurs. Obligatoire, non unique. */
  pseudo: string;
  email: string;
}
