/**
 * DTO de réponse pour les endpoints GET, POST et PUT de /api/teams.
 *
 * Ce type étend l'entité Team (qui reflète la table SQL) avec des champs
 * calculés qui ne sont pas stockés en base de données mais enrichissent
 * la réponse API.
 *
 * Pourquoi un DTO séparé plutôt que d'ajouter vehicleCount dans l'entité ?
 * L'entité Team est la source de vérité du schéma DB. Y mélanger des champs
 * calculés brouille cette responsabilité. Le DTO de réponse est le bon endroit
 * pour décrire la forme de ce que l'API retourne.
 *
 * Évolution prévue : quand le module Vehicle sera implémenté, vehicleCount
 * sera calculé par un COUNT SQL sur la table vehicles au lieu d'être hardcodé
 * à 0. Le type ici ne changera pas — seul le service sera mis à jour.
 */
import { Team } from '../team.entity';

export type TeamResponseDto = Team & {
  /**
   * Nombre de véhicules créés dans cette équipe.
   * Toujours 0 tant que le module Véhicules n'est pas implémenté.
   * Utilisé par le frontend pour verrouiller le choix du sponsor.
   */
  vehicleCount: number;
  /**
   * Vrai si l'équipe est déjà engagée dans une saison (n'importe quel état).
   * Permet au frontend de griser ou exclure l'équipe des sélecteurs de saison.
   */
  isEngaged: boolean;
};
