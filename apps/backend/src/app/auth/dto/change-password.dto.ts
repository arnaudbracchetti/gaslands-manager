import { IsString, MaxLength } from 'class-validator';

/**
 * DTO pour PATCH /api/auth/me/password — changement de mot de passe de
 * l'utilisateur connecté. `class-validator` (P0-7) ne borne que la taille
 * (anti-DoS avant bcrypt) — la longueur métier (6-72) reste validée par
 * l'agrégat `User.changePassword()`.
 */
export class ChangePasswordDto {
  @IsString()
  @MaxLength(200)
  currentPassword!: string;

  @IsString()
  @MaxLength(200)
  newPassword!: string;
}
