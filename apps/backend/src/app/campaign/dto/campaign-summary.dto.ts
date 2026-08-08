/**
 * DTO de réponse pour GET /api/seasons/by-code/:code.
 *
 * Volontairement minimal (CA2) : pas de fuite d'information sur les
 * participants ou le contenu de la saison à un utilisateur qui n'y participe
 * pas encore. `id` est inclus car nécessaire à l'appel suivant
 * (POST /api/seasons/:id/participants) — un identifiant numérique de saison
 * n'est pas une donnée sensible (contrairement à `inviteCode`).
 */
import { CampaignState } from '../domain/enums/campaign.enums';

export class CampaignSummaryDto {
  id: number;
  name: string;
  state: CampaignState;
  organizerName: string;
  participantCount: number;
  /** Budget en jerricans imposé aux équipes - permet au frontend de griser les équipes hors budget avant inscription. */
  budget: number;
}
