import { Game } from './game';
import { GameStatus } from '../enums/game-status.enum';
import type { GameEvent } from '../events/game-event';
import type { ResistanceEntry } from '../house-rules/resistance-distribution-strategy';
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
import { VehicleRenamedEvent } from '../events/vehicle-renamed.event';
import { SabotagePointsSpentEvent } from '../events/sabotage-points-spent.event';
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
        event instanceof FavoriDuPublicBonusEvent ||
        event instanceof SabotagePointsSpentEvent
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
      // VehicleRenamedEvent référence un vehicleId sans surcharger targetsVehicle() —
      // limitation connue assumée, cf. sa doc et docs/plans/2026-07-17-vehicle-instance-name-design.md.
      return event instanceof EquipmentChangedEvent || event instanceof VehicleRenamedEvent;
    }
    return false;
  }

  /**
   * Événement Télévisé uniquement — cf. `Game.distributeResistance` pour le contrat
   * complet (moment d'appel, ordre de persistance, pourquoi sans paramètre).
   *
   * 1. Résout sa propre Strategy via `this.context.strategyFactory` — jamais reçue
   *    en paramètre (cf. `Game.distributeResistance`).
   * 2. Garde d'idempotence : si le journal porte déjà un `ResistanceContactedEvent`
   *    marqué (`strategyKey` non nul), la distribution a déjà eu lieu pour cette
   *    partie — rattrape un rejeu de `EnterAtelierUseCase` après un échec de la
   *    persistance du statut (aucune transaction n'existe dans le projet).
   * 3. Relève ses propres `RankingAssignedEvent` — un par participant classé dans
   *    CETTE partie — pour calculer `classified` (la moitié classée) et le rang de
   *    chacun, sans jamais recevoir ce total en paramètre.
   * 4. Pour chaque participant classé, somme `championshipPointsAwarded` sur tout le
   *    journal filtré par son id (classement + exploits + Favori du Public, déjà
   *    journalisé à ce stade) et interroge la Strategy, un participant à la fois.
   */
  override distributeResistance(): GameEvent[] {
    const strategy = this.context.strategyFactory.createResistanceDistributionStrategy();

    const alreadyDistributed = this.events.some(
      (e) => e instanceof ResistanceContactedEvent && e.strategyKey !== null,
    );
    if (alreadyDistributed) return [];

    const rankingEvents = this.events.filter(
      (e): e is RankingAssignedEvent => e instanceof RankingAssignedEvent,
    );
    const classified = Math.ceil(rankingEvents.length / 2);

    const events: GameEvent[] = [];
    for (const ranking of rankingEvents) {
      const championshipPointsThisGame = this.events
        .filter((e) => e.participantId === ranking.participantId)
        .reduce((sum, e) => sum + e.championshipPointsAwarded, 0);

      const entry: ResistanceEntry = {
        participantId: ranking.participantId,
        rank: ranking.rank,
        championshipPointsThisGame,
      };
      if (strategy.isEligible(entry, { classified })) {
        const event = new ResistanceContactedEvent(0, this.id, ranking.participantId, 0, strategy.key);
        this.addEvent(event);
        events.push(event);
      }
    }
    return events;
  }
}
