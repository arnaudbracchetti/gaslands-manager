import type { IRandomizer } from '../randomizer.interface';
import type { ICatalogRepository } from '../../../team/domain/catalog.repository.interface';
import type { Vehicle } from '../../../team/domain/vehicle';
import type { GameEvent } from '../events/game-event';
import { WreckOutcome, type LostEquipment } from './wreck-outcome';
import { WreckResult } from '../enums/wreck-result.enum';
import { WreckResolvedEvent } from '../events/wreck-resolved.event';
import { WeaponLostEvent } from '../events/weapon-lost.event';
import { ImprovementLostEvent } from '../events/improvement-lost.event';
import { AdvantageLostEvent } from '../events/advantage-lost.event';
import { EquipmentChangedEvent } from '../events/equipment-changed.event';
import { EquipmentOperation, EquipmentEntityType } from '../enums/equipment-change.enums';
import { VehicleLostEvent } from '../events/vehicle-lost.event';
import { DomainException } from '../../../shared/domain/domain-exception';
import { wreckWeightModifier } from './wreck-weight-modifier';

export interface WreckTableResult {
  outcome: WreckOutcome;
  events: GameEvent[];
}

/**
 * Table des Épaves (Gaslands, p.168) — domain service.
 *
 * Encapsule l'intégralité du protocole de résolution :
 *   1. Lancer le D6 via `IRandomizer.roll(6)` (ou valeur forcée à 1, cf. Légende Vivante)
 *   2. Constituer le pool d'équipements éligibles (règle domaine)
 *   3. Tirer l'équipement perdu via `IRandomizer.pick(pool)` si ARRACHEE
 *   4. Calculer le tirage modifié et consulter la table
 *   5. Traduire le résultat en événements domaine (`gameId`, `participantId`)
 *
 * Si les règles évoluent (nouveau critère d'éligibilité, table étendue, effet d'une
 * nouvelle ligne), seule cette classe change — son interface publique
 * `resolve(vehicle, gameId, participantId)` reste stable.
 *
 * Tirage modifié = D6 + Chocs + modificateur de poids (Léger +1, Lourd −1).
 *
 *   ≤ 1  DEBOSSELE          − 1 choc (min 0)
 *   2–3  INDEMNE             0
 *   4    ROUE_CABOSSEE      +1
 *   5    ARRACHEE           +1 + équipement perdu (tiré au sort dans le pool)
 *   6    PIGNON_ENDOMMAGE   +1
 *   7    SIEGE_IRRECUPERABLE +2 → BUY(SEQUELLE, 'siege_irrecuperable', coût 0)
 *   8    CHASSIS_FRAGILISE  +2
 *   9    FAVORI_DU_PUBLIC   +3
 *   10+  VEHICULE_DETRUIT    0  → VehicleLostEvent
 *
 * Deux séquelles modifient ce protocole de façon PERMANENTE (aucune consommation,
 * tant qu'elles restent actives sur le véhicule) — deux modificateurs indépendants
 * de l'opération élémentaire `rollOnce`, qui se composent sans se connaître :
 *   - "legende_vivante" force la valeur du D6 à 1 à CHAQUE tirage (`rollOnce`).
 *   - "maintenu_par_la_rouille" fait rejouer un second tirage après le premier, Chocs
 *     mis à jour entre les deux (`resolve`) — sauf si le premier a déjà détruit le véhicule.
 */
export class WreckTable {
  constructor(
    private readonly random: IRandomizer,
    private readonly catalog: ICatalogRepository,
  ) {}

  resolve(vehicle: Vehicle, gameId: number, participantId: number): WreckTableResult {
    const first = this.rollOnce(vehicle, vehicle.chocs, gameId, participantId);
    const events = [...first.events];
    let finalOutcome = first.outcome;

    const rouilleActive = vehicle.hasActiveSequella('maintenu_par_la_rouille');
    const alreadyDestroyed = first.outcome.wreckResult === WreckResult.VEHICULE_DETRUIT;
    if (rouilleActive && !alreadyDestroyed) {
      const chocsAfterFirst = vehicle.chocs + first.outcome.chocsGained;
      const second = this.rollOnce(vehicle, chocsAfterFirst, gameId, participantId);
      events.push(...second.events);
      finalOutcome = second.outcome;
    }

    return { outcome: finalOutcome, events };
  }

  /**
   * Un tirage élémentaire — D6 (ou 1 si Légende Vivante active) + Chocs + poids → ligne
   * de la table → événements. Paramétré par `chocsBefore` (plutôt que de relire
   * `vehicle.chocs`) pour permettre le chaînage de Maintenu par la Rouille, dont le
   * second tirage doit utiliser les Chocs déjà mis à jour par le premier.
   *
   * Deux tirages indépendants : équipement (ARRACHEE — arme/amélioration) et
   * avantage (PIGNON_ENDOMMAGE). Le résultat de la table détermine laquelle des
   * deux pertes s'applique (jamais les deux en même temps).
   */
  private rollOnce(
    vehicle: Vehicle,
    chocsBefore: number,
    gameId: number,
    participantId: number,
  ): WreckTableResult {
    const diceRoll = vehicle.hasActiveSequella('legende_vivante') ? 1 : this.random.roll(6);
    const equipmentPool = this.buildEquipmentPool(vehicle);
    const lostEquipment = equipmentPool.length > 0 ? this.random.pick(equipmentPool) : null;
    const advantagePool = this.buildAdvantagePool(vehicle);
    const lostAdvantage = advantagePool.length > 0 ? this.random.pick(advantagePool) : null;
    const modifiedRoll = diceRoll + chocsBefore + wreckWeightModifier(vehicle.type.poids);
    const { result, chocsGained } = this.lookupTable(modifiedRoll, chocsBefore);
    const finalLoss =
      result === WreckResult.ARRACHEE ? lostEquipment :
      result === WreckResult.PIGNON_ENDOMMAGE ? lostAdvantage :
      null;
    const outcome = new WreckOutcome(vehicle.id, diceRoll, chocsBefore, result, chocsGained, finalLoss);
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

    if (outcome.wreckResult === WreckResult.PIGNON_ENDOMMAGE && outcome.advantageLostId !== null) {
      events.push(new AdvantageLostEvent(0, gameId, participantId, 0, outcome.advantageLostId));
    }

    if (outcome.wreckResult === WreckResult.SIEGE_IRRECUPERABLE) {
      const sequellaType = this.catalog.getSequellaType('siege_irrecuperable');
      if (!sequellaType) {
        throw new DomainException('Séquelle catalogue introuvable : "siege_irrecuperable".');
      }
      events.push(new EquipmentChangedEvent(
        0, gameId, participantId, 0,
        EquipmentOperation.BUY, EquipmentEntityType.SEQUELLE, 'siege_irrecuperable', 0,
        outcome.vehicleId, null, null,
        null, null, null, null,
        sequellaType, null,
      ));
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

  /**
   * Avantages non perdus et non vendus — tirage indépendant pour PIGNON_ENDOMMAGE.
   * Un objet vendu n'est plus effectif sur le véhicule — inutile de le tirer au sort.
   */
  private buildAdvantagePool(vehicle: Vehicle): NonNullable<LostEquipment>[] {
    return vehicle.advantages
      .filter((a) => !a.isSold && !a.isLost)
      .map((a) => ({ kind: 'advantage' as const, id: a.id }));
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
}
