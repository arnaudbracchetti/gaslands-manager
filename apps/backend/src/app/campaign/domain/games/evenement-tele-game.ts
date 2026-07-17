import { Game } from './game';
import { GameStatus } from '../enums/game-status.enum';
import type { GameEvent } from '../events/game-event';
import { RankingAssignedEvent } from '../events/ranking-assigned.event';
import { WalletMovementEvent } from '../events/wallet-movement.event';
import { VehicleLostEvent } from '../events/vehicle-lost.event';
import { WeaponLostEvent } from '../events/weapon-lost.event';
import { ImprovementLostEvent } from '../events/improvement-lost.event';
import { AdvantageLostEvent } from '../events/advantage-lost.event';
import { WreckResolvedEvent } from '../events/wreck-resolved.event';
import { ResistanceContactedEvent } from '../events/resistance-contacted.event';
import { GatesCrossedEvent } from '../events/gates-crossed.event';
import { VehicleDestroyedEvent } from '../events/vehicle-destroyed.event';
import { FavoriDuPublicBonusEvent } from '../events/favori-du-public-bonus.event';
import { EquipmentChangedEvent } from '../events/equipment-changed.event';
import { EquipmentEntityType } from '../enums/equipment-change.enums';

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
        event instanceof AdvantageLostEvent ||
        event instanceof WreckResolvedEvent ||
        // Séquelle imposée par la Table des Épaves (Siège irrécupérable) — seule
        // sous-catégorie d'EquipmentChangedEvent acceptée hors ATELIER : elle est
        // générée par le tirage (écran 3 du wizard), AVANT l'entrée en atelier
        // (`enterAtelier`, "Terminer"). Les autres entityType (VEHICLE/WEAPON/
        // IMPROVEMENT/ADVANTAGE) restent exclusivement réservés à l'ATELIER ci-dessous.
        (event instanceof EquipmentChangedEvent && event.entityType === EquipmentEntityType.SEQUELLE) ||
        event instanceof ResistanceContactedEvent ||
        event instanceof GatesCrossedEvent ||
        event instanceof VehicleDestroyedEvent ||
        event instanceof FavoriDuPublicBonusEvent
      );
    }
    if (this.status === GameStatus.ATELIER) {
      // ⚠️ L'annulation d'achat (Game.changeEquipment) supprime PHYSIQUEMENT un
      // EquipmentChangedEvent (BUY) de cette session — sûr uniquement parce qu'aucun AUTRE
      // événement accepté ici ne référence un weaponId/improvementId. Avant d'accepter un
      // nouveau type d'événement en ATELIER, vérifier qu'il ne référence pas un id
      // d'entité transiente WEAPON/IMPROVEMENT — sinon la suppression physique du BUY
      // laisserait une référence orpheline au replay. Cf.
      // docs/plans/2026-07-11-atelier-annulation-revente-design.md §1.
      return event instanceof EquipmentChangedEvent;
    }
    return false;
  }
}
