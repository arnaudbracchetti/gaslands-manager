/**
 * DTO pour la demande d'inscription à une saison.
 *
 * `teamId` désigne l'équipe du demandeur — le service vérifie qu'elle lui
 * appartient avant de créer le SeasonParticipant (cf. SeasonService.requestJoin,
 * réutilise TeamService.findOneForUser, même principe que CreateSeasonDto).
 */
export class JoinSeasonDto {
  teamId: number;
}
