import type { ITeamRepository, TeamSummaryDto } from '../domain/team.repository.interface';
import { LogUseCase } from '../log-use-case.decorator';

export interface GetTeamSummariesQuery {
  userId: number;
}

/**
 * Retourne la liste des équipes de l'utilisateur — read model pur.
 *
 * Aucun agrégat domaine n'est chargé. Le repository fait une seule requête SQL
 * avec COUNT imbriqués pour vehicleCount et isEngaged.
 */
export class GetTeamSummariesUseCase {
  constructor(private readonly teamRepo: ITeamRepository) {}

  @LogUseCase()
  execute(query: GetTeamSummariesQuery): Promise<TeamSummaryDto[]> {
    return this.teamRepo.findSummariesForUser(query.userId);
  }
}
