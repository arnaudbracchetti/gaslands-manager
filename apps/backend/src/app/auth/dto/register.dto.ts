/**
 * DTO (Data Transfer Object) pour l'inscription.
 *
 * Un DTO est un objet simple qui définit la forme des données
 * attendues dans le corps (body) d'une requête HTTP.
 * Il sert de contrat entre le client et l'API.
 *
 * Note : ce projet n'utilise pas class-validator pour rester simple.
 * La validation (champs obligatoires, longueur du mot de passe, normalisation
 * de l'email) vit dans l'agrégat `User` (domain/), pas ici ni dans un service.
 * Pour un projet en production, on ajouterait @IsEmail(), @MinLength(6), etc.
 * avec ValidationPipe dans main.ts.
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
  firstName: string;
  lastName: string;
  /** Nom d'affichage vu par les autres joueurs. Obligatoire, non unique. */
  pseudo: string;
  email: string;
  password: string;
  /** Jeton résolu par le widget Turnstile côté frontend. */
  captchaToken?: string;
  /** IP du demandeur, renseignée par le contrôleur via `@Ip()` - jamais par le client. */
  remoteIp?: string;
}
