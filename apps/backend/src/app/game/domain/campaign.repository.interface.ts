import type { Season } from './season';
import type { GameEvent } from './events/game-event';
import type { AtelierGame } from './games/atelier-game';

/**
 * Contrat de persistence du domaine campagne.
 *
 * Deux niveaux de persistance séparés (D-S4) :
 * - `appendEvents` : seule persistance normale — ajoute des GameEvent au journal
 * - `saveSeason`   : persistance structurelle — utilisée par FinalizeGame et CloseSeason
 *   pour persister les transitions de statut de parties et la création d'AtelierGame
 *
 * `findCampaign` reconstruit l'agrégat complet (Season + participants + jeux + événements
 * + Team figés chargés via ITeamRepository.findManyByIds).
 */
export interface ICampaignRepository {
  findCampaign(seasonId: number): Promise<Season>;
  appendEvents(gameId: number, events: GameEvent[]): Promise<void>;
  saveSeason(season: Season, newAtelier?: AtelierGame): Promise<void>;
}
