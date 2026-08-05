import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * DTO pour PATCH /api/auth/me — mise à jour du profil de l'utilisateur connecté.
 * `class-validator` (P0-7) ne couvre que la forme — la validation métier vit
 * dans l'agrégat `User` (domain/). Pas de `@IsEmail()` : même raison que
 * `RegisterDto` (invariant de `User`, pas dupliqué ici).
 *
 * `role` en est absent — un utilisateur ne change jamais son propre rôle.
 */
export class UpdateProfileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;

  /** Nom d'affichage vu par les autres joueurs. Obligatoire, non unique. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  pseudo!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  email!: string;
}
