import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO (Data Transfer Object) pour l'inscription.
 *
 * Un DTO est un objet simple qui définit la forme des données
 * attendues dans le corps (body) d'une requête HTTP.
 * Il sert de contrat entre le client et l'API.
 *
 * `class-validator` (P0-7) ne couvre ici que la FORME (type, présence,
 * borne anti-DoS) — la validation métier (longueur exacte du mot de passe,
 * normalisation de l'email) reste dans l'agrégat `User` (domain/), pas ici.
 * `email` n'a volontairement pas `@IsEmail()` : le format est un invariant
 * de `User`, le dupliquer créerait deux messages d'erreur concurrents.
 *
 * `role` en est volontairement absent : c'est ce qui rend impossible la
 * création d'un compte admin par inscription.
 *
 * `captchaToken`/`remoteIp` (P0-6) ne sont jamais lus par `User.register()` -
 * ils alimentent uniquement `ICaptchaVerifier.assertHuman()`, appelé par
 * `RegisterUseCase` avant l'agrégat. Optionnels : le chemin `NoopCaptchaVerifier`
 * (dev/e2e) et le `{}` posté par `backend-e2e` continuent de compiler.
 */
export class RegisterDto {
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

  @IsString()
  @MaxLength(200)
  password!: string;

  /** Jeton résolu par le widget Turnstile côté frontend. */
  @IsOptional()
  @IsString()
  captchaToken?: string;

  /** IP du demandeur, renseignée par le contrôleur via `@Ip()` - jamais par le client. */
  @IsOptional()
  @IsString()
  remoteIp?: string;
}
