import { Inject, Injectable } from '@nestjs/common';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import type { Campaign } from '../domain/campaign';
import { CAMPAIGN_REPOSITORY } from '../campaign.tokens';

/**
 * Service de lecture campagne — charge l'agrégat `Campaign` et rejoue son journal.
 *
 * Utilisé par tous les use cases en lecture (standings, état atelier, etc.).
 * Les use cases en écriture chargent aussi la saison via ce service, appliquent
 * leur commande en mémoire, puis délèguent la persistance au repository.
 */
@Injectable()
export class CampaignReplayService {
  constructor(
    @Inject(CAMPAIGN_REPOSITORY) private readonly campaignRepo: ICampaignRepository,
  ) {}

  /**
   * Charge la saison depuis la base et rejoue l'intégralité de son journal.
   * Retourne l'agrégat `Campaign` avec tous les états transients reconstruits.
   */
  async loadAndReplay(campaignId: number): Promise<Campaign> {
    const campaign = await this.campaignRepo.findCampaign(campaignId);
    campaign.replay();
    return campaign;
  }

  /**
   * Charge sans rejouer — pour les use cases qui rejoueront eux-mêmes
   * (ex. `replayUpTo` pour annulation partielle).
   */
  async load(campaignId: number): Promise<Campaign> {
    return this.campaignRepo.findCampaign(campaignId);
  }
}
