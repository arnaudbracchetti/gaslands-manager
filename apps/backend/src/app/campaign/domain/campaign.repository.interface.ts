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
}
