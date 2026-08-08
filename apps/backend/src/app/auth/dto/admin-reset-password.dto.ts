import { IsString, MaxLength } from 'class-validator';

/**
 * DTO pour PATCH /api/users/:id/password — réinitialise le mot de passe d'un
 * compte par un administrateur, sans connaître l'ancien. `class-validator`
 * (P0-7) ne borne que la taille (anti-DoS avant bcrypt) — la longueur
 * métier (6-72) reste validée par l'agrégat `User.resetPassword()`.
 */
export class AdminResetPasswordDto {
  @IsString()
  @MaxLength(200)
  newPassword!: string;
}
