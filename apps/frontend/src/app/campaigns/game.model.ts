/**
 * Interfaces TypeScript pour le Programme Télé (mode campagne, frontend).
 *
 * Miroir des DTOs backend (game-response.dto.ts, create-game.dto.ts).
 */

/** Type d'une partie — miroir de GameType (backend) */
export type GameType = 'EVENEMENT_TELE' | 'ESCARMOUCHE';

/** Statut d'une partie — miroir de GameStatus (backend) */
export type GameStatus = 'PLANIFIE' | 'ATELIER' | 'JOUE';

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

/**
 * Classement d'un participant saisi à l'écran 1 du wizard de fin de partie —
 * état purement client, avant fusion avec les épaves infligées (écran 2) pour
 * former le `RecordResultDto` final.
 */
export interface RankingEntry {
  participantId: number;
  rank: number;
  gatesCrossed?: number;
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

/**
 * Résultat d'un tirage sur la Table des Épaves (9 lignes) — miroir de WreckResult
 * (backend). Toute perte d'équipement est tirée au hasard côté serveur — jamais un
 * choix de l'utilisateur.
 */
export type WreckResult =
  | 'DEBOSSELE'
  | 'INDEMNE'
  | 'ROUE_CABOSSEE'
  | 'ARRACHEE'
  | 'PIGNON_ENDOMMAGE'
  | 'SIEGE_IRRECUPERABLE'
  | 'CHASSIS_FRAGILISE'
  | 'FAVORI_DU_PUBLIC'
  | 'VEHICULE_DETRUIT';

/** Équipement perdu à la ligne ARRACHEE — miroir de LostEquipment (backend). */
export interface LostEquipmentDto {
  kind: 'weapon' | 'improvement';
  id: number;
}

/** Corps de la requête POST /api/campaigns/:id/games/:gameId/events/wreck */
export interface WreckResolveRequestDto {
  participantId: number;
  vehicleId: number;
  /** Attestation manuelle : ce véhicule porte déjà un bonus "Favori du public" en attente. */
  pendingFavoriDuPublic?: boolean;
}

/** Snapshot du tirage — miroir de WreckOutcome (backend). */
export interface WreckOutcomeDto {
  vehicleId: number;
  diceRoll: number;
  chocsBefore: number;
  wreckResult: WreckResult;
  chocsGained: number;
  lostEquipment: LostEquipmentDto | null;
}

export interface WreckResolveResultDto {
  outcome: WreckOutcomeDto;
  /** Une ligne de texte par événement créé par ce tirage (cf. `GameEvent.describe()` backend). */
  descriptions: string[];
}

/** Résultat de POST .../enter-atelier — miroir de EnterAtelierResult (backend). */
export interface EnterAtelierResultDto {
  /** Id de la partie dont l'atelier a été auto-clôturé, s'il y en avait un ; sinon null. */
  autoClosedGameId: number | null;
}

/**
 * Désignation d'un véhicule mis en épave (écran 2 du wizard de fin de partie) —
 * état purement client, ne correspond à aucun contrat backend direct : les entrées
 * avec un vrai destructeur alimentent `destroyedVehicles` (RecordResultDto), la
 * liste complète pilote l'écran 3 (résolution de la Table des Épaves).
 */
export interface WreckedVehicleEntry {
  /** Propriétaire du véhicule mis en épave. */
  participantId: number;
  vehicleId: number;
  pendingFavoriDuPublic: boolean;
}

/** Résultat de l'écran 2 (désignation des épaves), transmis à l'orchestrateur du wizard. */
export interface WreckDesignationResult {
  /** Uniquement les entrées avec un vrai destructeur — alimente RecordResultDto. */
  destroyedVehicles: Map<number, DestroyedVehicleDto[]>;
  /** Toutes les désignations (détruit par X ou seul) — pilote l'écran 3. */
  wreckedVehicles: WreckedVehicleEntry[];
}
