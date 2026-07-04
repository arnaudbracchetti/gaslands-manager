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

/**
 * Une ligne du classement — miroir de StandingsEntry (backend). La clé de
 * correspondance avec CampaignParticipant est `participantId === CampaignParticipant.id`.
 * Pas de champ `rank` : dérivé côté frontend de l'ordre après tri. `resistancePoints`
 * est volontairement absent — mécanique secrète (cf. docs/spec/CAMPAIGN.md, US-F1).
 */
export interface StandingsEntry {
  participantId: number;
  userId: number;
  teamId: number;
  teamName: string;
  championshipPoints: number;
  wallet: number;
}
