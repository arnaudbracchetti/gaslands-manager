import { WreckResult } from '../enums/wreck-result.enum';

/**
 * Équipement perdu à la ligne ARRACHEE — `null` pour toute autre ligne, ou si le
 * véhicule n'a aucun équipement éligible (aucune arme ni amélioration montée).
 * Champ sérialisé tel quel (pas un getter) : le frontend en a besoin pour afficher
 * ce qui a été perdu.
 */
export type LostEquipment = { kind: 'weapon' | 'improvement'; id: number } | null;

/**
 * Résultat d'un lancer sur la Table des Épaves — Value Object.
 *
 * Le lancer de dé et le tirage aléatoire de l'équipement perdu (aléa/IO) restent dans
 * `WreckResolverService` (infrastructure, D-S9), mais la RÈGLE de la Table des Épaves —
 * tirage modifié, modificateur de poids et seuils de résultat — vit ici, dans le domaine,
 * via `fromRoll()`. Le use case convertit cet objet en commandes (`WreckResolvedEvent` +
 * éventuellement `WeaponLostEvent`/`ImprovementLostEvent`/`SequellaAddedEvent`/
 * `VehicleLostEvent`/`FavoriDuPublicBonusEvent`) qu'il persiste dans `game_events`.
 *
 * Table des Épaves (Gaslands, p.168) — tirage modifié = D6 + Chocs + modif. de poids :
 *   0-1 Débosselé · 2-3 Indemne · 4 Roue cabossée · 5 Arrachée · 6 Pignon endommagé ·
 *   7 Siège irrécupérable · 8 Châssis fragilisé · 9 Favori du public · 10+ Véhicule détruit.
 */
export class WreckOutcome {
  constructor(
    readonly vehicleId: number,
    readonly diceRoll: number,       // 1–6
    readonly chocsBefore: number,
    readonly wreckResult: WreckResult,
    readonly chocsGained: number,    // peut être négatif (DEBOSSELE)
    readonly lostEquipment: LostEquipment, // renseigné uniquement si ARRACHEE
  ) {}

  /**
   * Applique la Table des Épaves à un lancer déjà tiré. `lostEquipment` (tiré au hasard
   * par l'infrastructure parmi l'équipement du véhicule) n'est retenu que si le résultat
   * est ARRACHEE — pour toute autre ligne, il est ignoré même s'il est fourni.
   */
  static fromRoll(
    vehicleId: number,
    poids: string,
    chocsBefore: number,
    diceRoll: number,
    lostEquipment: LostEquipment,
  ): WreckOutcome {
    const modifiedRoll = diceRoll + chocsBefore + WreckOutcome.weightModifier(poids);
    const { result, chocsGained } = WreckOutcome.lookupTable(modifiedRoll, chocsBefore);
    const finalLoss = result === WreckResult.ARRACHEE ? lostEquipment : null;
    return new WreckOutcome(vehicleId, diceRoll, chocsBefore, result, chocsGained, finalLoss);
  }

  private static lookupTable(
    modifiedRoll: number,
    chocsBefore: number,
  ): { result: WreckResult; chocsGained: number } {
    if (modifiedRoll <= 1) return { result: WreckResult.DEBOSSELE, chocsGained: chocsBefore > 0 ? -1 : 0 };
    if (modifiedRoll >= 2 && modifiedRoll <= 3) return { result: WreckResult.INDEMNE, chocsGained: 0 };
    if (modifiedRoll === 4) return { result: WreckResult.ROUE_CABOSSEE, chocsGained: 1 };
    if (modifiedRoll === 5) return { result: WreckResult.ARRACHEE, chocsGained: 1 };
    if (modifiedRoll === 6) return { result: WreckResult.PIGNON_ENDOMMAGE, chocsGained: 1 };
    if (modifiedRoll === 7) return { result: WreckResult.SIEGE_IRRECUPERABLE, chocsGained: 2 };
    if (modifiedRoll === 8) return { result: WreckResult.CHASSIS_FRAGILISE, chocsGained: 2 };
    if (modifiedRoll === 9) return { result: WreckResult.FAVORI_DU_PUBLIC, chocsGained: 3 };
    return { result: WreckResult.VEHICULE_DETRUIT, chocsGained: 0 };
  }

  private static weightModifier(poids: string): number {
    if (poids === 'Léger') return 1;
    if (poids === 'Lourd') return -1;
    return 0; // Moyen
  }

  get vehicleIsLost(): boolean {
    return this.wreckResult === WreckResult.VEHICULE_DETRUIT;
  }

  get weaponLostId(): number | null {
    return this.lostEquipment?.kind === 'weapon' ? this.lostEquipment.id : null;
  }

  get improvementLostId(): number | null {
    return this.lostEquipment?.kind === 'improvement' ? this.lostEquipment.id : null;
  }
}
