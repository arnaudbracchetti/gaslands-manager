import type { Team } from './team';

/**
 * DTO de lecture légère — pas un agrégat domaine, pas de véhicules chargés.
 * Utilisé par GET /api/teams (liste) et retourné après chaque mutation de Team.
 */
export interface TeamSummaryDto {
  id: number;
  name: string;
  sponsor: string;
  cans: number;
  description: string | null;
  vehicleCount: number;
  /** Coût cumulé de tous les véhicules de l'équipe - critère d'éligibilité budget de campagne. */
  vehiclesCost: number;
  /** Budget applicable (Team.budget) : campaignBudget si engagée, sinon cans. Jamais recalculé par un consommateur. */
  budget: number;
  /** Non-null ⇒ budget imposé par la campagne qui engage cette équipe - `cans` devient alors en lecture seule côté UI. */
  campaignBudget: number | null;
  isEngaged: boolean;
  /**
   * Vrai si l'équipe participe (VALIDATED) à une campagne qui n'est plus
   * EN_CONSTRUCTION — toute mutation directe est alors refusée côté backend
   * (cf. Team.assertNotLocked()). Le frontend l'utilise pour désactiver
   * proactivement l'édition plutôt que de laisser l'utilisateur découvrir le
   * blocage via une erreur HTTP 400.
   */
  isLockedByCampaign: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Contrat de persistance pour l'agrégat Team.
 *
 * Deux catégories de méthodes :
 *
 * 1. Requêtes légères (sans domaine) : retournent des TeamSummaryDto calculés en SQL.
 *    Pas de chargement d'agrégat — optimisé pour la lecture de liste.
 *
 * 2. Chargement complet de l'agrégat : charge Team + tous ses Vehicle + Weapon +
 *    VehicleImprovement. Utilisé pour toutes les mutations.
 *
 * Trade-off assumé : findByVehicleId / findByWeaponId chargent TOUJOURS le Team
 * complet (tous ses véhicules, pas seulement le véhicule ciblé). Pour Gaslands
 * (3–5 véhicules par équipe), ce surcoût est négligeable.
 */
export interface ITeamRepository {
  // ── Requêtes légères (sans domaine) ──────────────────────────────────────────

  /** Retourne la liste des équipes avec vehicleCount et isEngaged — calcul SQL, pas d'agrégat. */
  findSummariesForUser(userId: number): Promise<TeamSummaryDto[]>;

  /** Retourne un TeamSummaryDto à jour après mutation. */
  findSummaryById(teamId: number): Promise<TeamSummaryDto>;

  // ── Chargement complet de l'agrégat (pour les mutations) ─────────────────────

  /** Charge Team + tous ses Vehicle + Weapon + VehicleImprovement. */
  findByIdForUser(teamId: number, userId: number): Promise<Team>;

  /** Point d'entrée par vehicleId — navigue jusqu'au Team racine. */
  findByVehicleId(vehicleId: number, userId: number): Promise<Team>;

  /** Point d'entrée par weaponId — pour DELETE /api/weapons/:id. */
  findByWeaponId(weaponId: number, userId: number): Promise<Team>;

  // ── Persistance ───────────────────────────────────────────────────────────────

  /** Sauvegarde Team complet (cascade sur Vehicle, Weapon, VehicleImprovement). */
  save(team: Team): Promise<Team>;

  /** Supprime l'équipe et tout son contenu (cascade). */
  remove(teamId: number, userId: number): Promise<void>;

  /**
   * Charge plusieurs agrégats Team par leurs ids (sans restriction userId).
   * Utilisé par CampaignRepository pour charger les équipes engagées en lot
   * lors du replay de l'agrégat Campaign (Partie 3).
   */
  findManyByIds(ids: number[]): Promise<Team[]>;

  /**
   * Campagnes qui perdraient leur dernier organisateur validé si cette équipe
   * était supprimée — cascade SQL `campaign_participants.teamId` (ON DELETE
   * CASCADE), qui ne passe jamais par `Campaign.assertNotLastOrganizer()`.
   * Utilisé par RemoveTeamUseCase pour refuser la suppression le cas échéant,
   * mirroir de `ICampaignRepository.findCampaignsWhereSoleValidatedOrganizer`
   * (même invariant, clé `teamId` au lieu de `userId`).
   */
  findCampaignsOrphanedIfTeamRemoved(teamId: number): Promise<{ id: number; name: string }[]>;
}
