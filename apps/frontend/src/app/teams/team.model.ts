/**
 * Interfaces TypeScript pour le domaine Teams (frontend).
 *
 * Ces interfaces décrivent la forme des données échangées avec le backend.
 * Elles ne contiennent pas de logique — uniquement des types.
 *
 * Séparation DTO vs entité :
 * - Team        : ce que l'API retourne (inclut id, userId, timestamps)
 * - CreateTeamDto : ce que l'on envoie pour créer (sans id ni timestamps)
 * - UpdateTeamDto : idem mais tous les champs sont optionnels
 */

/** Représentation complète d'une équipe retournée par l'API */
export interface Team {
  id: number;
  name: string;
  sponsor: string;
  cans: number;
  description?: string;
  userId: number;
  createdAt: string;
  updatedAt: string;
  /**
   * Nombre de véhicules créés dans cette équipe.
   * Utilisé pour verrouiller le choix du sponsor (immutable dès le 1er véhicule).
   * Toujours 0 tant que le module Véhicules n'est pas implémenté.
   */
  vehicleCount?: number;
}

/**
 * Informations enrichies d'un sponsor chargées depuis l'API /api/catalog/sponsors.
 * Miroir du type Sponsor côté backend (champs utiles pour le carousel).
 */
export interface SponsorInfo {
  /** Nom du sponsor (ex: "Rutherford", "Miyazaki") */
  nom: string;
  /** Description courte du style de jeu du sponsor */
  description: string;
  /** Classes d'avantage (2-3 badges, ex: ["Militaire", "Dur à Cuire"]) */
  classes_avantage: string[];
  /** Avantages spéciaux en texte markdown (sera converti en HTML pour l'affichage) */
  avantages_sponsorises: string;
}

/** Corps de la requête POST /api/teams */
export interface CreateTeamDto {
  name: string;
  sponsor: string;
  cans: number;
  description?: string;
}

/** Corps de la requête PUT /api/teams/:id (tous les champs sont optionnels) */
export type UpdateTeamDto = Partial<CreateTeamDto>;

/**
 * Liste des sponsors valides dans le jeu Gaslands.
 * Chaque sponsor détermine les armes et capacités spéciales disponibles.
 */
export const SPONSORS = [
  'Rutherford',
  'Miyazaki',
  'Idris',
  'Warden',
  'Highway Patrol',
  'Mishkin',
  'Slime Pit',
  'Verney',
  'Scarlett',
  'Locus',
] as const;

/** Valeurs de budget courantes pour faciliter la saisie */
export const DEFAULT_CANS = 50;
