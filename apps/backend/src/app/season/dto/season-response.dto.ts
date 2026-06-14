/**
 * DTO de réponse pour les endpoints GET et POST de /api/seasons.
 *
 * Étend l'entité Season avec des champs calculés non stockés en base :
 * - participantCount : nombre de SeasonParticipant pour cette saison (tous statuts)
 * - myRole           : rôle de l'utilisateur connecté dans cette saison, déduit
 *                      de son SeasonParticipant.isOrganizer
 */
import { Season } from '../season.entity';

export type SeasonResponseDto = Season & {
  participantCount: number;
  myRole: 'organizer' | 'participant';
};
