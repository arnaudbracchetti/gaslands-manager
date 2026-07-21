import { BadRequestException } from '@nestjs/common';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { DomainException } from '../../shared/domain/domain-exception';
import { WreckTable } from '../domain/wreck/wreck-table';
import type { WreckOutcome } from '../domain/wreck/wreck-outcome';
import { assertOrganizer } from './authorization.helpers';

export interface WreckResolveCommand {
  campaignId: number;
  gameId: number;
  participantId: number;
  userId: number;
  vehicleId: number;
  /**
   * Déclaration du joueur qu'il souhaite dépenser 3 votes du public pour déclencher le
   * bonus Favori du Public sur ce véhicule (ressource non trackée par l'application,
   * honor-system). Le serveur revérifie l'éligibilité réelle (`Vehicle.hasFavoriDuPublic`)
   * avant de créditer quoi que ce soit — cf. `Game.creditFavoriDuPublicBonus`. Indépendant
   * du résultat du tirage de cette partie : le simple fait que ce véhicule soit désigné
   * épave (donc que ce endpoint soit appelé pour lui) suffit, quel que soit le résultat.
   */
  pendingFavoriDuPublic?: boolean;
}

export interface WreckResolveResult {
  outcome: WreckOutcome;
  /** Une ligne de texte par événement créé (cf. `GameEvent.describe()`), dans l'ordre. */
  descriptions: string[];
}

/**
 * E1-E3 — Résout la Table des Épaves via le D6 serveur (D-S9).
 *
 * Toute perte d'équipement (arme ou amélioration) est un tirage aléatoire serveur —
 * jamais un choix de l'organisateur. L'interprétation du résultat (quels événements
 * produire selon la ligne obtenue) vit dans `Campaign.resolveWreck()` — ce use case
 * ne fait que tirer le résultat (infrastructure) et déléguer à l'agrégat. Le bonus
 * "Favori du public" est une règle indépendante du RÉSULTAT du tirage (mais dépend du
 * fait qu'un tirage ait lieu, donc que le véhicule soit désigné épave), traitée
 * séparément via `Game.creditFavoriDuPublicBonus()` — ce use case ne fait que lui
 * transmettre le choix brut du joueur, l'éligibilité réelle étant revérifiée côté
 * domaine, pas ici.
 */
export class WreckResolveUseCase {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly replayService: CampaignReplayService,
    private readonly wreckTable: WreckTable,
  ) {}

  async execute(cmd: WreckResolveCommand): Promise<WreckResolveResult> {
    const campaign = await this.replayService.loadAndReplay(cmd.campaignId);
    assertOrganizer(campaign, cmd.userId);
    const game = campaign.findGame(cmd.gameId);
    const participant = campaign.findParticipant(cmd.participantId);

    try {
      const { events, outcome } = game.resolveWreck(participant, cmd.vehicleId, this.wreckTable);

      const bonusEvent = game.creditFavoriDuPublicBonus(
        participant, outcome.vehicleId, cmd.pendingFavoriDuPublic ?? false,
      );
      if (bonusEvent) events.push(bonusEvent);

      await this.campaignRepo.appendEvents(cmd.gameId, events);
      return { outcome, descriptions: events.map((e) => e.describe(campaign.participants)) };
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }
  }
}
