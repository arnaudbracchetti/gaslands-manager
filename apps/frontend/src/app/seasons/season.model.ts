/**
 * Interfaces TypeScript pour le domaine Seasons (frontend).
 *
 * Même séparation que team.model.ts :
 * - Season         : ce que l'API retourne (inclut champs calculés participantCount/myRole)
 * - CreateSeasonDto : ce que l'on envoie pour créer
 */

/** États possibles d'une saison — miroir de SeasonState (backend) */
export type SeasonState = 'EN_CONSTRUCTION' | 'EN_COURS' | 'TERMINEE';

/** Représentation complète d'une saison retournée par l'API */
export interface Season {
  id: number;
  name: string;
  state: SeasonState;
  inviteCode: string;
  createdAt: string;
  updatedAt: string;
  /** Nombre de participants (tous statuts confondus) */
  participantCount: number;
  /** Rôle de l'utilisateur connecté dans cette saison */
  myRole: 'organizer' | 'participant';
  /**
   * Nombre de demandes d'inscription PENDING pour cette saison — présent
   * uniquement dans la réponse de GET /api/seasons/organizing/pending-requests.
   */
  pendingRequestsCount?: number;
  /** Nom de l'équipe engagée par l'utilisateur connecté — absent si sans équipe */
  myTeamName?: string;
}

/** Corps de la requête POST /api/seasons */
export interface CreateSeasonDto {
  name: string;
  /** Optionnel : l'organisateur peut créer sans équipe engagée (décision de design) */
  teamId?: number;
}

/** Informations minimales retournées par GET /api/seasons/by-code/:code */
export interface SeasonSummary {
  id: number;
  name: string;
  state: SeasonState;
  organizerName: string;
  participantCount: number;
}

/** Corps de la requête POST /api/seasons/:id/participants */
export interface JoinSeasonDto {
  teamId?: number | null;
}

/** Corps de la requête PUT /api/seasons/:id/state */
export interface ChangeStateDto {
  state: SeasonState;
}
