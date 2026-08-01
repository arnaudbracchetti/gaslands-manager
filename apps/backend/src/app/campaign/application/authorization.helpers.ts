import { NotFoundException } from '@nestjs/common';
import type { Campaign } from '../domain/campaign';
import type { CampaignParticipant } from '../domain/campaign-participant';

// ── Helpers partagés ────────────────────────────────────────────────────────────
// Réutilisés par les use cases campagne pour vérifier le rôle depuis l'état replay
// (campaign.participants), sans accès SQL supplémentaire.

export function assertOrganizer(campaign: Campaign, userId: number): CampaignParticipant {
  const p = campaign.participants.find((x) => x.userId === userId && x.isOrganizer);
  if (!p) throw new NotFoundException('Saison introuvable ou accès non autorisé.');
  return p;
}

export function assertParticipant(campaign: Campaign, userId: number): CampaignParticipant {
  const p = campaign.participants.find((x) => x.userId === userId);
  if (!p) throw new NotFoundException('Saison introuvable ou accès non autorisé.');   //TODO: Le message est il le bon ?
  return p;
}
