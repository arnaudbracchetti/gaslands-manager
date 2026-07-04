import { BadRequestException } from '@nestjs/common';
import { DomainException } from '../../shared/domain/domain-exception';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { assertOrganizer } from './record-ranking.usecase';
import { WeightClass } from '../domain/enums/weight-class.enum';

export interface RecordResultCommandItem {
  participantId: number;
  rank: number;
  /** Portes franchies (exploit, US-B2) — optionnel, 0/absent si aucune. */
  gatesCrossed?: number;
  /** Véhicules ennemis détruits par poids (exploit, US-B2) — optionnel. */
  destroyedVehicles?: { vehicleId: number; weightClass: string }[];
}

export interface RecordResultCommand {
  campaignId: number;
  gameId: number;
  userId: number;
  results: RecordResultCommandItem[];
}

/**
 * Enregistre le résultat d'une partie (organisateur, partie PLANIFIE).
 *
 * Convergence event-sourcing : l'agrégat crée un `RankingAssignedEvent` par
 * participant (PC calculés selon le type de partie) puis finalise la partie
 * (PLANIFIE → JOUE) et ouvre un AtelierGame intercalé. On persiste les
 * événements (`appendEvents`) puis la transition structurelle (`saveCampaign`).
 */
export class RecordResultUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
  ) {}

  async execute(cmd: RecordResultCommand): Promise<void> {
    const campaign = await this.replayService.load(cmd.campaignId);
    assertOrganizer(campaign, cmd.userId);

    let outcome;
    try {
      outcome = campaign.recordResult(
        cmd.gameId,
        cmd.results.map((r) => ({
          participantId: r.participantId,
          rank: r.rank,
          gatesCrossed: r.gatesCrossed,
          destroyedVehicles: r.destroyedVehicles?.map((d) => ({
            vehicleId: d.vehicleId,
            weightClass: this.parseWeightClass(d.weightClass),
          })),
        })),
      );
    } catch (e: unknown) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    await this.campaignRepo.appendEvents(cmd.gameId, outcome.events);
    await this.campaignRepo.saveCampaign(campaign, outcome.newAtelier);
  }

  private parseWeightClass(value: string): WeightClass {
    if (!Object.values(WeightClass).includes(value as WeightClass)) {
      throw new BadRequestException(`Poids de véhicule invalide : "${value}".`);
    }
    return value as WeightClass;
  }
}
