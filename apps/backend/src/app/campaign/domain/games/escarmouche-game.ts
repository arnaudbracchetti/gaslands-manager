import { Game } from './game';
import { GameStatus } from '../enums/game-status.enum';
import type { GameEvent } from '../events/game-event';
import { RankingAssignedEvent } from '../events/ranking-assigned.event';
import { WalletMovementEvent } from '../events/wallet-movement.event';
import { VehicleLostEvent } from '../events/vehicle-lost.event';
import { WeaponLostEvent } from '../events/weapon-lost.event';
import { WreckResolvedEvent } from '../events/wreck-resolved.event';
import { SequellaAddedEvent } from '../events/sequella-added.event';
import { ResistanceContactedEvent } from '../events/resistance-contacted.event';
import { GatesCrossedEvent } from '../events/gates-crossed.event';
import { VehicleDestroyedEvent } from '../events/vehicle-destroyed.event';

/**
 * Escarmouche — mêmes événements acceptés qu'un EvenementTeleGame.
 * La contrainte "PC = 0" est une règle write-time (use case), pas une règle canAccept.
 */
export class EscarmoucheGame extends Game {
  constructor(
    id: number,
    campaignId: number,
    status: GameStatus,
    order: number,
    readonly scenarioId: string,
    playedAt: Date | null,
    events: GameEvent[],
  ) {
    super(id, campaignId, status, order, playedAt, events);
  }

  override get type(): string { return 'ESCARMOUCHE'; }

  protected override get mutableStatus(): GameStatus { return GameStatus.PLANIFIE; }

  override canAccept(event: GameEvent): boolean {
    return (
      event instanceof RankingAssignedEvent ||
      event instanceof WalletMovementEvent ||
      event instanceof VehicleLostEvent ||
      event instanceof WeaponLostEvent ||
      event instanceof WreckResolvedEvent ||
      event instanceof SequellaAddedEvent ||
      event instanceof ResistanceContactedEvent ||
      event instanceof GatesCrossedEvent ||
      event instanceof VehicleDestroyedEvent
    );
  }
}
