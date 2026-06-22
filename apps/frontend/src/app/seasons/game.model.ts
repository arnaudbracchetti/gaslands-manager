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
  seasonId: number;
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

/** Corps de la requête POST /api/seasons/:id/games */
export interface CreateGameDto {
  scenarioId: string;
  /** Optionnel : par défaut, le backend reprend le type du scénario */
  type?: GameType;
}

/** Corps de la requête PUT /api/seasons/:id/games/:gameId */
export interface UpdateGameDto {
  scenarioId?: string;
  type?: GameType;
}
