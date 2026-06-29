import { Injectable } from '@nestjs/common';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import type { Season } from '../domain/season';

/**
 * Service de lecture campagne — charge l'agrégat `Season` et rejoue son journal.
 *
 * Utilisé par tous les use cases en lecture (standings, état atelier, etc.).
 * Les use cases en écriture chargent aussi la saison via ce service, appliquent
 * leur commande en mémoire, puis délèguent la persistance au repository.
 */
@Injectable()
export class CampaignReplayService {
  constructor(private readonly campaignRepo: ICampaignRepository) {}

  /**
   * Charge la saison depuis la base et rejoue l'intégralité de son journal.
   * Retourne l'agrégat `Season` avec tous les états transients reconstruits.
   */
  async loadAndReplay(seasonId: number): Promise<Season> {
    const season = await this.campaignRepo.findCampaign(seasonId);
    season.replay();
    return season;
  }

  /**
   * Charge sans rejouer — pour les use cases qui rejoueront eux-mêmes
   * (ex. `replayUpTo` pour annulation partielle).
   */
  async load(seasonId: number): Promise<Season> {
    return this.campaignRepo.findCampaign(seasonId);
  }
}
