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
   *
   * Seule méthode de chargement du module — utilisée uniformément par tous les use
   * cases, même ceux qui ne touchent qu'à la structure (participants/parties). Un
   * ancien `.load()` (sans replay) existait pour épargner ce calcul aux use cases
   * n'ayant besoin que de cette structure, mais s'est révélé être un piège : deux bugs
   * distincts (RecordResultUseCase, CampaignQueryService.getJournal/getParticipantJournal)
   * sont venus d'un use case qui aurait dû rejouer l'état mais utilisait `.load()` par
   * erreur — les entités transientes (véhicules/équipement achetés en atelier, id
   * négatif) n'existaient alors jamais en mémoire. Supprimé au profit d'un unique point
   * d'entrée : le coût du replay est négligible pour une campagne de ce jeu (peu de
   * parties/événements), largement inférieur au risque de récidive.
   */
  async loadAndReplay(campaignId: number): Promise<Campaign> {
    const campaign = await this.campaignRepo.findCampaign(campaignId);
    campaign.replay();
    return campaign;
  }
}
