import { WreckResult } from '../enums/wreck-result.enum';

/**
 * Résultat d'un lancer sur la Table des Épaves — Value Object.
 *
 * Le lancer de dé (aléa/IO) reste dans `WreckResolverService` (infrastructure, D-S9),
 * mais la RÈGLE de la Table des Épaves — tirage modifié, modificateur de poids et
 * seuils de résultat — vit ici, dans le domaine, via `fromRoll()`. Le use case convertit
 * cet objet en commandes `WreckResolvedEvent` (+ éventuellement `WeaponLostEvent` /
 * `VehicleLostEvent`) qu'il persiste dans `game_events`.
 *
 * Table des Épaves (Gaslands, p.168) — tirage modifié = D6 + Chocs + modif. de poids :
 *   ≤ 3 : Épargné (0 choc) · 4–5 : +1 · 6–7 : +2 · 8–9 : Arme arrachée · 10+ : Épave.
 */
export class WreckOutcome {
  constructor(
    readonly vehicleId: number,
    readonly diceRoll: number,       // 1–6
    readonly chocsBefore: number,
    readonly wreckResult: WreckResult,
    readonly chocsGained: number,
    readonly weaponLostId: number | null, // renseigné si ARME_PERDUE
  ) {}

  /**
   * Applique la Table des Épaves à un lancer déjà tiré. `weaponIdChoice` n'est retenu
   * que si le résultat est ARME_PERDUE.
   */
  static fromRoll(
    vehicleId: number,
    poids: string,
    chocsBefore: number,
    diceRoll: number,
    weaponIdChoice: number | null,
  ): WreckOutcome {
    const modifiedRoll = diceRoll + chocsBefore + WreckOutcome.weightModifier(poids);
    const { result, chocsGained } = WreckOutcome.lookupTable(modifiedRoll);
    const weaponLostId = result === WreckResult.ARME_PERDUE ? weaponIdChoice : null;
    return new WreckOutcome(vehicleId, diceRoll, chocsBefore, result, chocsGained, weaponLostId);
  }

  private static lookupTable(modifiedRoll: number): { result: WreckResult; chocsGained: number } {
    if (modifiedRoll <= 3) return { result: WreckResult.CHOCS_GAGNE, chocsGained: 0 };
    if (modifiedRoll <= 5) return { result: WreckResult.CHOCS_GAGNE, chocsGained: 1 };
    if (modifiedRoll <= 7) return { result: WreckResult.CHOCS_GAGNE, chocsGained: 2 };
    if (modifiedRoll <= 9) return { result: WreckResult.ARME_PERDUE, chocsGained: 0 };
    return { result: WreckResult.EPAVE, chocsGained: 0 };
  }

  private static weightModifier(poids: string): number {
    if (poids === 'Léger') return 1;
    if (poids === 'Lourd') return -1;
    return 0; // Moyen
  }

  get vehicleIsLost(): boolean {
    return this.wreckResult === WreckResult.EPAVE;
  }

  get weaponIsLost(): boolean {
    return this.wreckResult === WreckResult.ARME_PERDUE && this.weaponLostId !== null;
  }
}
