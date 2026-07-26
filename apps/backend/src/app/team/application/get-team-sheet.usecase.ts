import type { ITeamRepository } from '../domain/team.repository.interface';
import { BadRequestException } from '@nestjs/common';
import { teamToSheetDto } from '../infrastructure/team-sheet.mapper';
import { renderTeamSheetHtml } from '../infrastructure/team-sheet.renderer';

export interface GetTeamSheetQuery {
  teamId: number;
  userId: number;
  playerName: string;
}

/**
 * Génère la fiche d'équipe exportable (HTML imprimable) depuis l'état construction
 * d'équipe — pour une équipe NON verrouillée par une campagne en cours.
 *
 * Rejette si `team.isLocked` : au-delà de EN_CONSTRUCTION, les chocs/séquelles réels
 * ne sont recalculés que par replay campagne (jamais reflétés sur cette lecture
 * directe) — laisser passer produirait une fiche silencieusement incomplète plutôt
 * qu'une erreur claire. Réutilise `team.isLocked`, déjà hydraté par `TeamRepository`
 * pour verrouiller les mutations directes (`assertNotLocked`) — même donnée, même
 * raison, appliquée ici à la lecture export.
 */
export class GetTeamSheetUseCase {
  constructor(private readonly teamRepo: ITeamRepository) {}

  async execute(query: GetTeamSheetQuery): Promise<string> {
    const team = await this.teamRepo.findByIdForUser(query.teamId, query.userId);
    if (team.isLocked) {
      throw new BadRequestException(
        'Cette équipe est verrouillée par une campagne en cours — exportez sa fiche depuis la page de la campagne.',
      );
    }
    const dto = teamToSheetDto({
      teamName: team.name,
      sponsor: team.sponsor,
      playerName: query.playerName,
      sabotagePoints: null,
      votesPublic: null,
      vehicles: team.vehicles,
    });
    return renderTeamSheetHtml(dto);
  }
}
