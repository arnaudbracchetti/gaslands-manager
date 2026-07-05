import { Game } from './game';
import { GameStatus } from '../enums/game-status.enum';
import type { GameEvent } from '../events/game-event';
import { RankingAssignedEvent } from '../events/ranking-assigned.event';
import { WalletMovementEvent } from '../events/wallet-movement.event';
import { VehicleLostEvent } from '../events/vehicle-lost.event';
import { WeaponLostEvent } from '../events/weapon-lost.event';
import { ImprovementLostEvent } from '../events/improvement-lost.event';
import { WreckResolvedEvent } from '../events/wreck-resolved.event';
import { SequellaAddedEvent } from '../events/sequella-added.event';
import { ResistanceContactedEvent } from '../events/resistance-contacted.event';
import { GatesCrossedEvent } from '../events/gates-crossed.event';
import { VehicleDestroyedEvent } from '../events/vehicle-destroyed.event';
import { FavoriDuPublicBonusEvent } from '../events/favori-du-public-bonus.event';
import { EquipmentChangedEvent } from '../events/equipment-changed.event';

export class EvenementTeleGame extends Game {
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

  override get type(): string { return 'EVENEMENT_TELE'; }

  override canAccept(event: GameEvent): boolean {
    if (this.status === GameStatus.PLANIFIE) {
      return (
        event instanceof RankingAssignedEvent ||
        event instanceof WalletMovementEvent ||
        event instanceof VehicleLostEvent ||
        event instanceof WeaponLostEvent ||
        event instanceof ImprovementLostEvent ||
        event instanceof WreckResolvedEvent ||
        event instanceof SequellaAddedEvent || // séquelle imposée par la Table des Épaves (Siège irrécupérable)
        event instanceof ResistanceContactedEvent ||
        event instanceof GatesCrossedEvent ||
        event instanceof VehicleDestroyedEvent ||
        event instanceof FavoriDuPublicBonusEvent
      );
    }
    if (this.status === GameStatus.ATELIER) {
      return event instanceof EquipmentChangedEvent || event instanceof SequellaAddedEvent;
    }
    return false;
  }
}
