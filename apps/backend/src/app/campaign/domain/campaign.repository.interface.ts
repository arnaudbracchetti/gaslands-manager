import type { Campaign } from './campaign';
import type { GameEvent } from './events/game-event';
import type { AtelierGame } from './games/atelier-game';

/**
 * Contrat de persistence du domaine campagne.
 *
 * Deux niveaux de persistance séparés (D-S4) :
 * - `appendEvents` : seule persistance normale — ajoute des GameEvent au journal
 * - `saveCampaign`   : persistance structurelle — utilisée par FinalizeGame et CloseCampaign
 *   pour persister les transitions de statut de parties et la création d'AtelierGame
 *
 * `findCampaign` reconstruit l'agrégat complet (Campaign + participants + jeux + événements
 * + Team figés chargés via ITeamRepository.findManyByIds).
 */
export interface ICampaignRepository {
  findCampaign(campaignId: number): Promise<Campaign>;
  appendEvents(gameId: number, events: GameEvent[]): Promise<void>;
  saveCampaign(campaign: Campaign, newAtelier?: AtelierGame): Promise<void>;

  /**
   * Crée une campagne et son participant organisateur (VALIDATED). Retourne l'id
   * de la campagne créée. Cas particulier : aucun agrégat n'existe encore.
   */
  createCampaign(
    name: string,
    inviteCode: string,
    organizerUserId: number,
    teamId: number | null,
  ): Promise<number>;

  /**
   * Persiste les mutations CRUD de l'agrégat : campagne (name/state), participants
   * (upsert + suppression via `removedParticipantIds`), parties (upsert +
   * suppression via `removedGameIds`). Rétro-alimente les ids des entités créées.
   */
  saveStructural(campaign: Campaign): Promise<void>;

  /** Supprime définitivement une campagne (cascade sur participants/parties). */
  deleteCampaign(campaignId: number): Promise<void>;

  /**
   * Indique si l'équipe est déjà engagée dans une campagne — invariant d'unicité
   * *global* (au-delà de l'agrégat courant), donc porté par le repository et non
   * par l'agrégat. `excludeCampaignId` exclut la campagne courante (changement
   * d'équipe au sein d'une même campagne).
   */
  isTeamEngaged(teamId: number, excludeCampaignId?: number): Promise<boolean>;
}
