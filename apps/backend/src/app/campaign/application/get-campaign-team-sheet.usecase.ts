import { NotFoundException } from '@nestjs/common';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { assertParticipant, assertOrganizer } from './authorization.helpers';
import { teamToSheetDto } from '../../team/infrastructure/team-sheet.mapper';
import { renderTeamSheetHtml } from '../../team/infrastructure/team-sheet.renderer';
import type { Campaign } from '../domain/campaign';
import type { CampaignParticipant } from '../domain/campaign-participant';

export interface GetCampaignTeamSheetCommand {
  campaignId: number;
  userId: number;
  playerName: string;
  /** Fiche d'UN AUTRE participant — réservé à l'organisateur. Absent = sa propre fiche. */
  participantId?: number;
}

/**
 * Génère la fiche d'équipe exportable (HTML imprimable) depuis l'état campagne
 * après replay complet — seul chemin qui reflète les chocs/séquelles réels
 * (event-sourcés, jamais persistés sur `Team`/`Vehicle` directement).
 *
 * Ne passe volontairement PAS par `WorkshopVehicleDto` (taillé pour l'UI achat/
 * revente atelier — `purchasedThisSession`, `resaleRefund`, pas de `nom` résolu sur
 * armes/améliorations/avantages) : `me.team.vehicles` donne directement des
 * `Vehicle` avec équipement déjà résolu, réutilisables tels quels par le même
 * mapper que le chemin équipe directe (`GetTeamSheetUseCase`).
 */
export class GetCampaignTeamSheetUseCase {
  constructor(private readonly replayService: CampaignReplayService) {}

  async execute(cmd: GetCampaignTeamSheetCommand): Promise<string> {
    const campaign = await this.replayService.loadAndReplay(cmd.campaignId);
    const target = this.resolveTarget(campaign, cmd.userId, cmd.participantId);
    if (!target.hasTeam) {
      throw new NotFoundException('Campagne introuvable ou accès non autorisé.');
    }
    const leaderPoints = campaign.standings()[0]?.championshipPoints ?? target.championshipPoints;
    const dto = teamToSheetDto({
      teamName: target.team.name,
      sponsor: target.team.sponsor,
      playerName: cmd.playerName,
      // Contrairement à GetWorkshopUseCase (atelier, ouvert à tout participant
      // VALIDATED), cette route tierce est déjà réservée à l'organisateur
      // (resolveTarget) — le secret D-S4 (vis-à-vis des AUTRES joueurs) ne
      // s'applique donc pas ici : toujours affiché, y compris sur la fiche d'un tiers.
      sabotagePoints: target.sabotagePoints,
      votesPublic: target.votesPublicFor(leaderPoints),
      vehicles: target.team.vehicles,
    });
    return renderTeamSheetHtml(dto);
  }

  /**
   * Sans `participantId` : sa propre fiche — comportement historique. Avec
   * `participantId` : fiche d'un tiers, réservée à l'organisateur
   * (`assertOrganizer`) — contrairement à l'atelier/journal en lecture seule
   * (`GetWorkshopUseCase`), ouverts à tout participant `VALIDATED`.
   */
  private resolveTarget(campaign: Campaign, userId: number, participantId?: number): CampaignParticipant {
    if (participantId === undefined) return assertParticipant(campaign, userId);

    assertOrganizer(campaign, userId);
    const target = campaign.participants.find((p) => p.id === participantId);
    if (!target) {
      throw new NotFoundException('Participant introuvable.');
    }
    return target;
  }
}
