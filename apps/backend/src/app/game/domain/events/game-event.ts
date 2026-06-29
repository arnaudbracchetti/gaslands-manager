import { DomainException } from '../../../shared/domain/domain-exception';
import type { CampaignParticipant } from '../campaign-participant';

/**
 * Commande de campagne — GoF Command.
 *
 * Chaque événement est un **fait persisté** dans `game_events`. Son `execute()` applique
 * un effet purement transient en mémoire (modifie Team, Vehicle, Weapon ou les compteurs
 * du participant). Aucune persistance dans `execute()` — seul le use case écrit en base.
 *
 * Propriété fondamentale (event sourcing) :
 *   `execute(p)` puis `undo(p)` → état identique à l'état initial.
 */
export abstract class GameEvent {
  constructor(
    readonly id: number,
    readonly gameId: number,
    readonly participantId: number,
    readonly eventOrder: number,
  ) {}

  abstract execute(participants: CampaignParticipant[]): void;
  abstract undo(participants: CampaignParticipant[]): void;

  protected findParticipant(participants: CampaignParticipant[]): CampaignParticipant {
    const p = participants.find((x) => x.id === this.participantId);
    if (!p) throw new DomainException(`Participant #${this.participantId} introuvable dans la saison`);
    return p;
  }
}
