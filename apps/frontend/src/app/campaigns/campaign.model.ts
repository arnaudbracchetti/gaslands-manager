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
  /** Clés (nom_interne) des règles maison actuellement activées sur cette campagne. */
  houseRules: string[];
}

/** Corps de la requête POST /api/campaigns */
export interface CreateCampaignDto {
  name: string;
  /** Optionnel : l'organisateur peut créer sans équipe engagée (décision de design) */
  teamId?: number;
  /** Budget en jerricans imposé aux équipes - défaut backend 50 si absent. */
  budget?: number;
  /** Clés (nom_interne) des règles maison à activer dès la création - défaut backend aucune. */
  houseRules?: string[];
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
  /** Clés (nom_interne) des règles maison actives - affichées avant même de rejoindre (cf. RM-7). */
  houseRules: string[];
}

/**
 * Règle maison du catalogue - miroir de HouseRuleDefinition (backend
 * `apps/backend/src/app/campaign/house-rule.interfaces.ts`). Les deux champs
 * `description_*` sont déjà convertis Markdown → HTML au chargement du
 * catalogue backend (cf. HouseRuleCatalogService) - se lient donc via
 * [innerHTML], jamais en texte brut.
 */
export interface HouseRuleDefinition {
  nom: string;
  nom_interne: string;
  /** Ligne affichée case décochée - rappel du comportement par défaut. */
  description_decochee: string;
  /** Ligne affichée case cochée - comportement alternatif appliqué par la règle. */
  description_cochee: string;
}

/** Corps de la requête PUT /api/campaigns/:id/house-rules - aucune contrainte d'état. */
export interface SetHouseRulesDto {
  houseRules: string[];
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
