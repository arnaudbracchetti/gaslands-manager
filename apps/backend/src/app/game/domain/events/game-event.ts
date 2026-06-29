import { DomainException } from '../../../shared/domain/domain-exception';
import type { SeasonParticipant } from '../season-participant';

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

  abstract execute(participants: SeasonParticipant[]): void;
  abstract undo(participants: SeasonParticipant[]): void;

  protected findParticipant(participants: SeasonParticipant[]): SeasonParticipant {
    const p = participants.find((x) => x.id === this.participantId);
    if (!p) throw new DomainException(`Participant #${this.participantId} introuvable dans la saison`);
    return p;
  }
}
