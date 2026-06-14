/**
 * DTO pour la création d'une saison.
 *
 * `teamId` désigne l'équipe du créateur qui participera à la saison —
 * le service vérifie qu'elle lui appartient avant de créer quoi que ce soit
 * (cf. SeasonService.create, réutilise TeamService.findOneForUser).
 */
export class CreateSeasonDto {
  name: string;
  teamId: number;
}
