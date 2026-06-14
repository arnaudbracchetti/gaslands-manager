/**
 * Interfaces TypeScript pour les participants d'une saison (frontend).
 *
 * Même séparation que season.model.ts.
 */

/** Statut d'inscription d'un participant — miroir de ParticipantStatus (backend) */
export type ParticipantStatus = 'PENDING' | 'VALIDATED' | 'REJECTED';

/** Représentation d'un participant retournée par l'API */
export interface SeasonParticipant {
  id: number;
  userId: number;
  teamId: number;
  status: ParticipantStatus;
  isOrganizer: boolean;
  userName: string;
  teamName: string;
}

/** Corps de la requête PUT /api/seasons/:id/participants/:pid/validate */
export interface ValidateParticipantDto {
  accept: boolean;
}
