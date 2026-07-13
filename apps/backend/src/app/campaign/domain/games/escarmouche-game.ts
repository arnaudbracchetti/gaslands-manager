import { Game } from './game';
import { GameStatus } from '../enums/game-status.enum';
import type { GameEvent } from '../events/game-event';
import { RankingAssignedEvent } from '../events/ranking-assigned.event';
import { WalletMovementEvent } from '../events/wallet-movement.event';
import { VehicleLostEvent } from '../events/vehicle-lost.event';
import { WeaponLostEvent } from '../events/weapon-lost.event';
import { ImprovementLostEvent } from '../events/improvement-lost.event';
import { WreckResolvedEvent } from '../events/wreck-resolved.event';
import { ResistanceContactedEvent } from '../events/resistance-contacted.event';
import { GatesCrossedEvent } from '../events/gates-crossed.event';
import { VehicleDestroyedEvent } from '../events/vehicle-destroyed.event';
import { FavoriDuPublicBonusEvent } from '../events/favori-du-public-bonus.event';
import { EquipmentChangedEvent } from '../events/equipment-changed.event';
import { EquipmentEntityType } from '../enums/equipment-change.enums';

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

  override canAccept(event: GameEvent): boolean {
    if (this.status === GameStatus.PLANIFIE) {
      return (
        event instanceof RankingAssignedEvent ||
        event instanceof WalletMovementEvent ||
        event instanceof VehicleLostEvent ||
        event instanceof WeaponLostEvent ||
        event instanceof ImprovementLostEvent ||
        event instanceof WreckResolvedEvent ||
        // Séquelle imposée par la Table des Épaves (Siège irrécupérable) — cf. le même
        // commentaire dans EvenementTeleGame.canAccept.
        (event instanceof EquipmentChangedEvent && event.entityType === EquipmentEntityType.SEQUELLE) ||
        event instanceof ResistanceContactedEvent ||
        event instanceof GatesCrossedEvent ||
        event instanceof VehicleDestroyedEvent ||
        event instanceof FavoriDuPublicBonusEvent
      );
    }
    if (this.status === GameStatus.ATELIER) {
      // ⚠️ Cf. le même commentaire dans EvenementTeleGame.canAccept : la suppression
      // physique du BUY (annulation d'achat) n'est sûre que parce qu'aucun autre événement
      // accepté ici ne référence un weaponId/improvementId.
      return event instanceof EquipmentChangedEvent;
    }
    return false;
  }
}
