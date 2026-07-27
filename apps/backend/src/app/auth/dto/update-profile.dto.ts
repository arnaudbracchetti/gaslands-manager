/**
 * DTO pour PATCH /api/auth/me — mise à jour du profil de l'utilisateur connecté.
 * Pas de class-validator (convention du projet) : validation manuelle dans AuthService.
 */
export class UpdateProfileDto {
  firstName: string;
  lastName: string;
  email: string;
}
