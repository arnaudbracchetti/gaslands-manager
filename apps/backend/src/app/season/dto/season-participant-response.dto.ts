/**
 * DTO de réponse pour GET /api/seasons/:id/participants et
 * PUT /api/seasons/:id/participants/:pid/validate.
 *
 * Enrichit SeasonParticipant avec le nom de l'utilisateur et de l'équipe
 * (résolus via les relations `user`/`team`), pour affichage direct côté
 * frontend sans appel supplémentaire.
 */
import { ParticipantStatus } from '../season.enums';

export interface SeasonParticipantResponseDto {
  id: number;
  userId: number;
  teamId: number;
  status: ParticipantStatus;
  isOrganizer: boolean;
  userName: string;
  teamName: string;
}
