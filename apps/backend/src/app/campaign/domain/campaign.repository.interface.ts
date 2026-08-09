import type { Campaign } from './campaign';
import type { GameEvent } from './events/game-event';

/**
 * Contrat de persistence du domaine campagne.
 *
 * Deux niveaux de persistance séparés (D-S4) :
 * - `appendEvents` : seule persistance normale — ajoute des GameEvent au journal
 * - `saveCampaign`   : persistance structurelle — utilisée par EnterAtelier, CloseAtelier
 *   et CloseCampaign pour persister les transitions de statut des parties
 *
 * `findCampaign` reconstruit l'agrégat complet (Campaign + participants + jeux + événements
 * + Team figés chargés via ITeamRepository.findManyByIds).
 */
export interface ICampaignRepository {
  findCampaign(campaignId: number): Promise<Campaign>;
  appendEvents(gameId: number, events: GameEvent[]): Promise<void>;

  /**
   * Supprime définitivement un événement du journal — utilisé UNIQUEMENT pour
   * l'annulation d'un achat de la session d'atelier en cours (Game.changeEquipment,
   * `deleteEventId`) : l'achat n'a jamais eu lieu, donc rien à compenser par un événement
   * inverse (contrairement à `undo()`, qui reste utilisé pour le replay partiel).
   */
  deleteEvent(eventId: number): Promise<void>;

  /**
   * Supprime plusieurs événements en une seule opération atomique — annulation cascade
   * d'un véhicule acheté PENDANT la session d'atelier en cours (cf.
   * `Game.collectSessionEventsForVehicle`) : l'événement d'achat du véhicule ET tout
   * événement qui le référence doivent disparaître ensemble, sans fenêtre intermédiaire.
   */
  deleteEvents(eventIds: number[]): Promise<void>;

  saveCampaign(campaign: Campaign): Promise<void>;

  /**
   * Crée une campagne et son participant organisateur (VALIDATED). Retourne l'id
   * de la campagne créée. Cas particulier : aucun agrégat n'existe encore.
   */
  createCampaign(
    name: string,
    inviteCode: string,
    organizerUserId: number,
    teamId: number | null,
    budget: number,
  ): Promise<number>;

  /**
   * Persiste les mutations CRUD de l'agrégat : campagne (name/state/budget),
   * participants (upsert + suppression via `removedParticipantIds`), parties
   * (upsert + suppression via `removedGameIds`). Rétro-alimente les ids des
   * entités créées.
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

  /**
   * Campagnes où `userId` est actuellement l'unique organisateur `VALIDATED` -
   * invariant transversal (au-delà d'une seule campagne chargée), donc porté
   * par le repository, même raisonnement qu'`isTeamEngaged` ci-dessus. Utilisé
   * par `RemoveUserUseCase` pour refuser une suppression qui laisserait une
   * campagne sans organisateur (mirroir cross-campagne de
   * `Campaign.assertNotLastOrganizer`, qui ne s'applique qu'à une campagne déjà
   * chargée).
   */
  findCampaignsWhereSoleValidatedOrganizer(userId: number): Promise<{ id: number; name: string }[]>;
}
