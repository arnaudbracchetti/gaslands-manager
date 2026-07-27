/**
 * DTO pour PATCH /api/auth/me/password — changement de mot de passe de
 * l'utilisateur connecté. Pas de class-validator (convention du projet) :
 * validation manuelle dans AuthService.
 */
export class ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}
