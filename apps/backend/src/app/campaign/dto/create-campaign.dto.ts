/**
 * DTO pour la création d'une saison.
 *
 * `teamId` désigne l'équipe du créateur qui participera à la saison —
 * optionnel : l'organisateur peut gérer une saison sans équipe engagée
 * (décision de design, cf. docs/plans/design/README.md §divergences).
 * Si fourni, le use case vérifie qu'elle lui appartient (ITeamRepository.findByIdForUser).
 */
export class CreateCampaignDto {
  name: string;
  teamId?: number;
}
