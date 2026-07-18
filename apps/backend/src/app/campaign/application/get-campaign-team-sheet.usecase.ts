import { NotFoundException } from '@nestjs/common';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { assertParticipant } from './authorization.helpers';
import { teamToSheetDto } from '../../team/infrastructure/team-sheet.mapper';
import { renderTeamSheetHtml } from '../../team/infrastructure/team-sheet.renderer';

export interface GetCampaignTeamSheetCommand {
  campaignId: number;
  userId: number;
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
    const me = assertParticipant(campaign, cmd.userId);
    if (!me.hasTeam) {
      throw new NotFoundException('Campagne introuvable ou accès non autorisé.');
    }
    const dto = teamToSheetDto(me.team.name, me.team.sponsor, me.team.vehicles);
    return renderTeamSheetHtml(dto);
  }
}
