/**
 * DTO de réponse pour GET /api/seasons/:id/participants et
 * PUT /api/seasons/:id/participants/:pid/validate.
 *
 * Enrichit CampaignParticipant avec le nom de l'utilisateur et de l'équipe
 * (résolus via les relations `user`/`team`), pour affichage direct côté
 * frontend sans appel supplémentaire.
 */
import { ParticipantStatus } from '../campaign.enums';

export interface CampaignParticipantResponseDto {
  id: number;
  userId: number;
  teamId: number | null;
  status: ParticipantStatus;
  isOrganizer: boolean;
  userName: string;
  teamName: string;
}
