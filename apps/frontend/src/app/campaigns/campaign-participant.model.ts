/**
 * Interfaces TypeScript pour les participants d'une campagne (frontend).
 *
 * Même séparation que campaign.model.ts.
 */

/** Statut d'inscription d'un participant — miroir de ParticipantStatus (backend) */
export type ParticipantStatus = 'PENDING' | 'VALIDATED' | 'REJECTED';

/** Représentation d'un participant retournée par l'API */
export interface CampaignParticipant {
  id: number;
  userId: number;
  teamId: number | null;
  status: ParticipantStatus;
  isOrganizer: boolean;
  userName: string;
  teamName: string;
}

/** Corps de la requête PUT /api/campaigns/:id/participants/:pid/validate */
export interface ValidateParticipantDto {
  accept: boolean;
}
