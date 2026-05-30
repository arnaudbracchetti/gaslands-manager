/**
 * DTO (Data Transfer Object) pour l'inscription.
 *
 * Un DTO est un objet simple qui définit la forme des données
 * attendues dans le corps (body) d'une requête HTTP.
 * Il sert de contrat entre le client et l'API.
 *
 * Note : ce projet n'utilise pas class-validator pour rester simple.
 * La validation basique (champs obligatoires, longueur) est faite
 * dans AuthService. Pour un projet en production, on ajouterait
 * @IsEmail(), @MinLength(6), etc. avec ValidationPipe dans main.ts.
 */
export class RegisterDto {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}
