import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * DTO pour la connexion.
 * On n'envoie que l'email et le mot de passe en clair (via HTTPS).
 * Le serveur compare avec le hash bcrypt stocké en base.
 */
export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MaxLength(200)
  password!: string;
}
