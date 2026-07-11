import type { IRandomizer } from '../randomizer.interface';
import type { Vehicle } from '../../../team/domain/vehicle';
import type { GameEvent } from '../events/game-event';
import { WreckOutcome, type LostEquipment } from './wreck-outcome';
import { WreckResult } from '../enums/wreck-result.enum';
import { WreckResolvedEvent } from '../events/wreck-resolved.event';
import { WeaponLostEvent } from '../events/weapon-lost.event';
import { ImprovementLostEvent } from '../events/improvement-lost.event';
import { SequellaAddedEvent } from '../events/sequella-added.event';
import { VehicleLostEvent } from '../events/vehicle-lost.event';

export interface WreckTableResult {
  outcome: WreckOutcome;
  events: GameEvent[];
}

/**
 * Table des Épaves (Gaslands, p.168) — domain service.
 *
 * Encapsule l'intégralité du protocole de résolution :
 *   1. Lancer le D6 via `IRandomizer.roll(6)`
 *   2. Constituer le pool d'équipements éligibles (règle domaine)
 *   3. Tirer l'équipement perdu via `IRandomizer.pick(pool)` si ARRACHEE
 *   4. Calculer le tirage modifié et consulter la table
 *   5. Traduire le résultat en événements domaine (`gameId`, `participantId`)
 *
 * Si les règles évoluent (second jet, nouveau critère d'éligibilité, table étendue,
 * effet d'une nouvelle ligne), seule cette classe change — son interface publique
 * `resolve(vehicle, gameId, participantId)` reste stable.
 *
 * Tirage modifié = D6 + Chocs + modificateur de poids (Léger +1, Lourd −1).
 *
 *   ≤ 1  DEBOSSELE          − 1 choc (min 0)
 *   2–3  INDEMNE             0
 *   4    ROUE_CABOSSEE      +1
 *   5    ARRACHEE           +1 + équipement perdu (tiré au sort dans le pool)
 *   6    PIGNON_ENDOMMAGE   +1
 *   7    SIEGE_IRRECUPERABLE +2 → SequellaAddedEvent (Siège irrécupérable, coût 0)
 *   8    CHASSIS_FRAGILISE  +2
 *   9    FAVORI_DU_PUBLIC   +3
 *   10+  VEHICULE_DETRUIT    0  → VehicleLostEvent
 */
export class WreckTable {
  constructor(private readonly random: IRandomizer) {}

  resolve(vehicle: Vehicle, gameId: number, participantId: number): WreckTableResult {
    const diceRoll = this.random.roll(6);
    const pool = this.buildEquipmentPool(vehicle);
    const lostEquipment = pool.length > 0 ? this.random.pick(pool) : null;
    const modifiedRoll = diceRoll + vehicle.chocs + this.weightModifier(vehicle.type.poids);
    const { result, chocsGained } = this.lookupTable(modifiedRoll, vehicle.chocs);
    const finalLoss = result === WreckResult.ARRACHEE ? lostEquipment : null;
    const outcome = new WreckOutcome(vehicle.id, diceRoll, vehicle.chocs, result, chocsGained, finalLoss);
    return { outcome, events: this.buildEvents(outcome, gameId, participantId) };
  }

  private buildEvents(outcome: WreckOutcome, gameId: number, participantId: number): GameEvent[] {
    const events: GameEvent[] = [];

    events.push(new WreckResolvedEvent(
      0, gameId, participantId, 0,
      outcome.vehicleId, outcome.diceRoll, outcome.chocsBefore,
      outcome.wreckResult, outcome.chocsGained,
    ));

    if (outcome.wreckResult === WreckResult.ARRACHEE && outcome.weaponLostId !== null) {
      events.push(new WeaponLostEvent(0, gameId, participantId, 0, outcome.weaponLostId));
    }

    if (outcome.wreckResult === WreckResult.ARRACHEE && outcome.improvementLostId !== null) {
      events.push(new ImprovementLostEvent(0, gameId, participantId, 0, outcome.improvementLostId));
    }

    if (outcome.wreckResult === WreckResult.SIEGE_IRRECUPERABLE) {
      events.push(new SequellaAddedEvent(0, gameId, participantId, 0, outcome.vehicleId, 'siege_irrecuperable', 0));
    }

    if (outcome.wreckResult === WreckResult.VEHICULE_DETRUIT) {
      events.push(new VehicleLostEvent(0, gameId, participantId, 0, outcome.vehicleId));
    }

    return events;
  }

  // ── Helpers privés ────────────────────────────────────────────────────────────

  /**
   * Armes non perdues et non vendues + améliorations non perdues, non vendues et non
   * intégrées (estDefaut). Un objet vendu n'est plus physiquement sur le véhicule — il ne
   * doit jamais être tiré au sort par cette table (sinon "arraché" une seconde fois).
   */
  private buildEquipmentPool(vehicle: Vehicle): NonNullable<LostEquipment>[] {
    return [
      ...vehicle.weapons.filter((w) => !w.isLost && !w.isSold).map((w) => ({ kind: 'weapon' as const, id: w.id })),
      ...vehicle.improvements
        .filter((i) => !i.estDefaut && !i.isLost && !i.isSold)
        .map((i) => ({ kind: 'improvement' as const, id: i.id })),
    ];
  }

  private lookupTable(
    modifiedRoll: number,
    chocsBefore: number,
  ): { result: WreckResult; chocsGained: number } {
    if (modifiedRoll <= 1) return { result: WreckResult.DEBOSSELE, chocsGained: chocsBefore > 0 ? -1 : 0 };
    if (modifiedRoll <= 3) return { result: WreckResult.INDEMNE, chocsGained: 0 };
    if (modifiedRoll === 4) return { result: WreckResult.ROUE_CABOSSEE, chocsGained: 1 };
    if (modifiedRoll === 5) return { result: WreckResult.ARRACHEE, chocsGained: 1 };
    if (modifiedRoll === 6) return { result: WreckResult.PIGNON_ENDOMMAGE, chocsGained: 1 };
    if (modifiedRoll === 7) return { result: WreckResult.SIEGE_IRRECUPERABLE, chocsGained: 2 };
    if (modifiedRoll === 8) return { result: WreckResult.CHASSIS_FRAGILISE, chocsGained: 2 };
    if (modifiedRoll === 9) return { result: WreckResult.FAVORI_DU_PUBLIC, chocsGained: 3 };
    return { result: WreckResult.VEHICULE_DETRUIT, chocsGained: 0 };
  }

  private weightModifier(poids: string): number {
    if (poids === 'Léger') return 1;
    if (poids === 'Lourd') return -1;
    return 0;
  }
}
