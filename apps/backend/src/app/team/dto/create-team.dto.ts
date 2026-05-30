/**
 * DTO (Data Transfer Object) pour la création d'une équipe.
 *
 * Un DTO décrit la forme exacte des données attendues dans le corps de la requête HTTP.
 * Il sert à la fois de documentation et de contrat entre le frontend et le backend.
 *
 * Pourquoi un DTO séparé de l'entité ?
 * - L'entité Team contient des champs gérés par le serveur (id, userId, createdAt…)
 *   que le client ne doit pas pouvoir fournir directement.
 * - Le DTO expose uniquement ce que le client peut envoyer.
 */
export class CreateTeamDto {
  // Nom de l'équipe — obligatoire
  name: string;

  // Sponsor de l'équipe — détermine les armes disponibles dans Gaslands
  // Valeurs possibles : Rutherford, Miyazaki, Idris, Warden, Highway Patrol…
  sponsor: string;

  // Budget en jerricans — optionnel, le backend applique le défaut (50) si absent
  cans?: number;

  // Description libre — optionnelle
  description?: string;
}
