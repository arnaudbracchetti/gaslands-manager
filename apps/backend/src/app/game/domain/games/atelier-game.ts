import { Game } from './game';
import { GameStatus } from '../enums/game-status.enum';
import type { GameEvent } from '../events/game-event';
import { EquipmentChangedEvent } from '../events/equipment-changed.event';
import { SequellaAddedEvent } from '../events/sequella-added.event';

/**
 * Période d'atelier entre deux parties — achats, reventes et échanges de Chocs.
 * Statuts : OUVERT (actif) → CLOTURE (figé après la partie suivante ou fin de saison).
 * scenarioId est null (pas de scénario associé).
 */
export class AtelierGame extends Game {
  constructor(
    id: number,
    seasonId: number,
    status: GameStatus,
    order: number,
    events: GameEvent[],
  ) {
    super(id, seasonId, status, order, null, events);
  }

  override get type(): string { return 'ATELIER'; }

  override canAccept(event: GameEvent): boolean {
    return event instanceof EquipmentChangedEvent || event instanceof SequellaAddedEvent;
  }
}
