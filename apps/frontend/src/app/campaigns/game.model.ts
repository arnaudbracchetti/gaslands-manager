/**
 * Interfaces TypeScript pour le Programme Télé (mode campagne, frontend).
 *
 * Miroir des DTOs backend (game-response.dto.ts, create-game.dto.ts).
 */

/** Type d'une partie — miroir de GameType (backend) */
export type GameType = 'EVENEMENT_TELE' | 'ESCARMOUCHE';

/** Statut d'une partie — miroir de GameStatus (backend) */
export type GameStatus = 'PLANIFIE' | 'JOUE';

/** Une partie du Programme telle que retournée par l'API */
export interface Game {
  id: number;
  campaignId: number;
  /** nom_interne du scénario (clé du catalogue) */
  scenarioId: string;
  /** Libellé du scénario résolu côté backend (champ calculé) */
  scenarioName: string;
  type: GameType;
  status: GameStatus;
  /** Position dans le programme (tri ASC) */
  order: number;
  playedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Un scénario du catalogue, retourné par GET /api/catalog/scenarios */
export interface Scenario {
  nom: string;
  nom_interne: string;
  type: GameType;
  /** Description en HTML (Markdown converti côté backend) */
  description: string;
}

/** Corps de la requête POST /api/campaigns/:id/games */
export interface CreateGameDto {
  scenarioId: string;
  /** Optionnel : par défaut, le backend reprend le type du scénario */
  type?: GameType;
}

/** Corps de la requête PUT /api/campaigns/:id/games/:gameId */
export interface UpdateGameDto {
  scenarioId?: string;
  type?: GameType;
}

/** Résultat d'une partie enregistré — miroir de GameResultDto (backend) */
export interface GameResult {
  id: number;
  gameId: number;
  participantId: number;
  rank: number;
  championshipPoints: number;
  createdAt: string;
}

/**
 * Poids d'un véhicule détruit (exploit, US-B2) — miroir de WeightClass (backend).
 * FORTERESSE n'existe pas encore dans le catalogue (aucun véhicule n'y est
 * classé) mais la valeur est posée pour ne rien avoir à changer le jour où le
 * catalogue en gagnera.
 */
export type WeightClass = 'LEGER' | 'MOYEN' | 'LOURD' | 'FORTERESSE';

/** Un véhicule ennemi détruit, saisi dans le formulaire de résultat (exploit, US-B2). */
export interface DestroyedVehicleDto {
  vehicleId: number;
  weightClass: WeightClass;
}

/** Corps de la requête POST /api/campaigns/:id/games/:gameId/results */
export interface RecordResultDto {
  results: {
    participantId: number;
    rank: number;
    /** Portes franchies (exploit, US-B2) — omis/0 si aucune. */
    gatesCrossed?: number;
    /** Véhicules ennemis détruits par poids (exploit, US-B2) — omis si aucun. */
    destroyedVehicles?: DestroyedVehicleDto[];
  }[];
}

/**
 * Véhicule courant d'un participant, retourné par
 * GET /api/campaigns/:id/games/:gameId/participant-vehicles — alimente le
 * picker "véhicules ennemis détruits" du formulaire de résultat.
 */
export interface ParticipantVehicleDto {
  vehicleId: number;
  nom: string;
  weightClass: WeightClass;
}

export interface ParticipantVehiclesDto {
  participantId: number;
  vehicles: ParticipantVehicleDto[];
}
