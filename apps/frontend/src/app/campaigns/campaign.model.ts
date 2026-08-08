/**
 * Interfaces TypeScript pour le domaine Campaigns (frontend).
 *
 * Même séparation que team.model.ts :
 * - Campaign         : ce que l'API retourne (inclut champs calculés participantCount/myRole)
 * - CreateCampaignDto : ce que l'on envoie pour créer
 */

/** États possibles d'une campagne — miroir de CampaignState (backend) */
export type CampaignState = 'EN_CONSTRUCTION' | 'EN_COURS' | 'TERMINEE';

/** Représentation complète d'une campagne retournée par l'API */
export interface Campaign {
  id: number;
  name: string;
  state: CampaignState;
  inviteCode: string;
  createdAt: string;
  updatedAt: string;
  /** Nombre de participants (tous statuts confondus) */
  participantCount: number;
  /** Rôle de l'utilisateur connecté dans cette campagne */
  myRole: 'organizer' | 'participant';
  /**
   * Nombre de demandes d'inscription PENDING pour cette campagne — présent
   * uniquement dans la réponse de GET /api/campaigns/organizing/pending-requests.
   */
  pendingRequestsCount?: number;
  /** Nom de l'équipe engagée par l'utilisateur connecté — absent si sans équipe */
  myTeamName?: string;
  /** Budget en jerricans imposé à toutes les équipes de la campagne - remplace Team.cans pour tout calcul en contexte campagne. */
  budget: number;
}

/** Corps de la requête POST /api/campaigns */
export interface CreateCampaignDto {
  name: string;
  /** Optionnel : l'organisateur peut créer sans équipe engagée (décision de design) */
  teamId?: number;
  /** Budget en jerricans imposé aux équipes - défaut backend 50 si absent. */
  budget?: number;
}

/** Informations minimales retournées par GET /api/campaigns/by-code/:code */
export interface CampaignSummary {
  id: number;
  name: string;
  state: CampaignState;
  organizerName: string;
  participantCount: number;
  /** Budget en jerricans imposé aux équipes - permet de griser les équipes hors budget avant inscription. */
  budget: number;
}

/** Corps de la requête POST /api/campaigns/:id/participants */
export interface JoinCampaignDto {
  teamId?: number | null;
}

/** Corps de la requête PUT /api/campaigns/:id/state */
export interface ChangeStateDto {
  state: CampaignState;
}

/** Corps de la requête PUT /api/campaigns/:id - modification nom/budget (EN_CONSTRUCTION uniquement). */
export interface UpdateCampaignDto {
  name: string;
  budget: number;
}
