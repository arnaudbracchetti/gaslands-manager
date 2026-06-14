/**
 * DTO de réponse pour les endpoints GET et POST de /api/seasons.
 *
 * Étend l'entité Season avec des champs calculés non stockés en base :
 * - participantCount     : nombre de SeasonParticipant pour cette saison (tous statuts)
 * - myRole               : rôle de l'utilisateur connecté dans cette saison, déduit
 *                          de son SeasonParticipant.isOrganizer
 * - pendingRequestsCount : nombre de demandes d'inscription PENDING (autres que les
 *                          siennes) pour cette saison — présent uniquement pour les
 *                          saisons organisées retournées par
 *                          GET /api/seasons/organizing/pending-requests (US4)
 */
import { Season } from '../season.entity';

export type SeasonResponseDto = Season & {
  participantCount: number;
  myRole: 'organizer' | 'participant';
  pendingRequestsCount?: number;
};
