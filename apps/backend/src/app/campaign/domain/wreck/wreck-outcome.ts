import { WreckResult } from '../enums/wreck-result.enum';

/**
 * Équipement perdu à la ligne ARRACHEE — `null` pour toute autre ligne, ou si le
 * véhicule n'a aucun équipement éligible (aucune arme ni amélioration montée).
 * Champ sérialisé tel quel (pas un getter) : le frontend en a besoin pour afficher
 * ce qui a été perdu.
 */
export type LostEquipment = { kind: 'weapon' | 'improvement'; id: number } | null;

/**
 * Snapshot du résultat d'un lancer sur la Table des Épaves — Value Object pur.
 *
 * Produit par `WreckTable.resolve()` (domain service) qui encapsule la règle
 * complète (tirage modifié, modificateur de poids, pool d'équipements, création
 * des événements domaine). `Campaign.resolveWreck()` délègue entièrement à
 * `WreckTable` et se contente de journaliser les événements retournés.
 */
export class WreckOutcome {
  constructor(
    readonly vehicleId: number,
    readonly diceRoll: number,              // 1–6
    readonly chocsBefore: number,
    readonly wreckResult: WreckResult,
    readonly chocsGained: number,           // peut être négatif (DEBOSSELE)
    readonly lostEquipment: LostEquipment,  // renseigné uniquement si ARRACHEE
  ) {}

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
