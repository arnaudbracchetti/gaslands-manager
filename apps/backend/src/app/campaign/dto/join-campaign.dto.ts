/**
 * DTO pour la demande d'inscription à une saison.
 *
 * `teamId` désigne l'équipe du demandeur — le use case vérifie qu'elle lui
 * appartient avant de créer le CampaignParticipant (RequestJoinUseCase,
 * ITeamRepository.findByIdForUser, même principe que CreateCampaignDto).
 */
export class JoinCampaignDto {
  // nullable : l'organisateur peut se désengager d'une saison en passant null
  teamId?: number | null;
}
